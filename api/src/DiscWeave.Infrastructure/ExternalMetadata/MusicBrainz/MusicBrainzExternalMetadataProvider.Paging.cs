using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private const string ChronologyIncompleteWarning = "musicbrainz.release_chronology_incomplete";
    private const string PageLimitWarning = "musicbrainz.release_page_limit_reached";
    private const string RouteInvalidWarning = "musicbrainz.release_route_invalid";
    private const string GroupContextWarning = "musicbrainz.release_group_context_incomplete";

    internal Task<ExternalMetadataResult<ReleaseBrowseOutcome>> BrowseReleasesAsync(
        string recordingMbid,
        CancellationToken cancellationToken)
    {
        return !_options.Enabled
            ? Task.FromResult(Failure<ReleaseBrowseOutcome>(Disabled()))
            : TryNormalizeMbid(recordingMbid, out string normalized)
            ? ExecuteOwnedAsync(
                "release-browse",
                outcome => outcome.Releases.Count,
                context => BrowseReleasesCoreAsync(
                    normalized,
                    loadReleaseGroups: true,
                    context,
                    CancellationToken.None),
                cancellationToken)
            : Task.FromResult(Failure<ReleaseBrowseOutcome>(InvalidResponse()));
    }

    internal Task<ExternalMetadataResult<ReleaseBrowseOutcome>> BrowseReleasesAsync(
        string recordingMbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return TryNormalizeMbid(recordingMbid, out string normalized)
            ? BrowseReleasesCoreAsync(
                normalized,
                loadReleaseGroups: true,
                context,
                cancellationToken)
            : Task.FromResult(Failure<ReleaseBrowseOutcome>(InvalidResponse()));
    }

    internal Task<ExternalMetadataResult<ReleaseBrowseOutcome>> BrowseReleasePagesAsync(
        string recordingMbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return TryNormalizeMbid(recordingMbid, out string normalized)
            ? BrowseReleasesCoreAsync(
                normalized,
                loadReleaseGroups: false,
                context,
                cancellationToken)
            : Task.FromResult(Failure<ReleaseBrowseOutcome>(InvalidResponse()));
    }

    private async Task<ExternalMetadataResult<ReleaseBrowseOutcome>> BrowseReleasesCoreAsync(
        string recordingMbid,
        bool loadReleaseGroups,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        var releases = new List<ReleaseRoute>();
        var warnings = new List<string>();
        int offset = 0;
        int pagesFetched = 0;
        int? total = null;
        bool chronologyComplete = true;
        bool reachedTerminalPage = false;

        while (pagesFetched < _options.MaxReleasePagesPerRecording)
        {
            ExternalMetadataResult<ReleasePageResponse> page = await GetReleasePageCoreAsync(
                recordingMbid,
                offset,
                context,
                cancellationToken).ConfigureAwait(false);
            if (!page.IsSuccess)
            {
                chronologyComplete = false;
                AddPageFailureWarning(warnings, page.Error);
                if (releases.Count == 0 &&
                    page.Error.Code != OperationBudgetExhaustedCode &&
                    page.Error.Kind != ExternalMetadataErrorKind.Timeout)
                {
                    return Failure<ReleaseBrowseOutcome>(page.Error);
                }

                break;
            }

            if (page.Value.Releases is null)
            {
                chronologyComplete = false;
                AddWarning(warnings, ChronologyIncompleteWarning);
                if (releases.Count == 0)
                {
                    return Failure<ReleaseBrowseOutcome>(InvalidResponse());
                }

                break;
            }

            pagesFetched++;
            int returnedCount = page.Value.Releases.Count;
            foreach (ReleaseDto release in page.Value.Releases)
            {
                bool mapped = TryMapReleaseRoute(
                    release,
                    recordingMbid,
                    out ReleaseRoute route,
                    out bool invalidRows);
                if (mapped)
                {
                    releases.Add(route);
                }

                if (invalidRows)
                {
                    chronologyComplete = false;
                    AddWarning(warnings, RouteInvalidWarning);
                }
            }

            int nextOffset = offset + returnedCount;
            int? reportedTotal = page.Value.ReleaseCount ?? page.Value.Count;
            if (reportedTotal is int candidateTotal && candidateTotal < nextOffset)
            {
                chronologyComplete = false;
                AddWarning(warnings, ChronologyIncompleteWarning);
            }
            else
            {
                total = reportedTotal ?? total;
            }

            offset = nextOffset;
            if (returnedCount == 0 ||
                (total is int knownTotal && offset >= knownTotal) ||
                (returnedCount < 100 && total is null))
            {
                reachedTerminalPage = true;
                break;
            }
        }

        if (!reachedTerminalPage &&
            pagesFetched >= _options.MaxReleasePagesPerRecording)
        {
            chronologyComplete = false;
            AddWarning(warnings, PageLimitWarning);
        }

        IReadOnlyList<ReleaseGroupDetailOutcome> groups = [];
        bool groupContextComplete = true;
        if (loadReleaseGroups)
        {
            (groups, groupContextComplete) = await LoadReleaseGroupsAsync(
                releases,
                warnings,
                context,
                cancellationToken).ConfigureAwait(false);
        }

        return new ExternalMetadataResult<ReleaseBrowseOutcome>(
            new ReleaseBrowseOutcome(
                releases,
                groups,
                chronologyComplete,
                groupContextComplete,
                warnings));
    }

    private async Task<(IReadOnlyList<ReleaseGroupDetailOutcome> Groups, bool Complete)> LoadReleaseGroupsAsync(
        IReadOnlyList<ReleaseRoute> releases,
        List<string> warnings,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        string[] groupMbids =
        [
            .. releases
                .Select(release => release.ReleaseGroupMbid)
                .Where(mbid => mbid is not null)
                .Select(mbid => mbid!)
                .Distinct(StringComparer.Ordinal)
        ];
        bool complete = groupMbids.Length <= _options.MaxReleaseGroupLookups;
        if (!complete)
        {
            AddWarning(warnings, GroupContextWarning);
        }

        var groups = new List<ReleaseGroupDetailOutcome>();
        foreach (string groupMbid in groupMbids.Take(_options.MaxReleaseGroupLookups))
        {
            ExternalMetadataResult<ReleaseGroupDetailOutcome> group = await GetReleaseGroupDetailCoreAsync(
                groupMbid,
                context,
                cancellationToken).ConfigureAwait(false);
            if (group.IsSuccess)
            {
                groups.Add(group.Value);
                continue;
            }

            complete = false;
            AddWarning(warnings, GroupContextWarning);
            if (group.Error.Code == OperationBudgetExhaustedCode ||
                group.Error.Kind == ExternalMetadataErrorKind.Timeout)
            {
                AddWarning(warnings, OperationBudgetExhaustedCode);
            }
        }

        return (groups, complete);
    }

    private static void AddPageFailureWarning(
        List<string> warnings,
        ExternalMetadataError error)
    {
        AddWarning(
            warnings,
            error.Code == OperationBudgetExhaustedCode ||
                error.Kind == ExternalMetadataErrorKind.Timeout
                    ? OperationBudgetExhaustedCode
                    : ChronologyIncompleteWarning);
    }

    private static void AddWarning(List<string> warnings, string warning)
    {
        if (!warnings.Contains(warning, StringComparer.Ordinal))
        {
            warnings.Add(warning);
        }
    }
}
