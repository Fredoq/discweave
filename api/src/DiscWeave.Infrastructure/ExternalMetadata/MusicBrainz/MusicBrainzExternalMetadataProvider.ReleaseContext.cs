using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private const string SourceReleaseContextWarning =
        "musicbrainz.source_release_context_incomplete";
    private const string SourceReleaseLimitWarning =
        "musicbrainz.source_release_limit_reached";

    internal Task<ExternalMetadataResult<ReleaseContextOutcome>> BrowseSourceReleaseContextAsync(
        string recordingMbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return TryNormalizeMbid(recordingMbid, out string normalized)
            ? BrowseSourceReleaseContextCoreAsync(normalized, context, cancellationToken)
            : Task.FromResult(Failure<ReleaseContextOutcome>(InvalidResponse()));
    }

    internal Task<ExternalMetadataResult<ReleaseContextOutcome>> BrowseReleaseGroupContextAsync(
        string releaseGroupMbid,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        return TryNormalizeMbid(releaseGroupMbid, out string normalized)
            ? BrowseReleaseGroupContextCoreAsync(normalized, context, cancellationToken)
            : Task.FromResult(Failure<ReleaseContextOutcome>(InvalidResponse()));
    }

    private async Task<ExternalMetadataResult<ReleaseContextOutcome>>
        BrowseSourceReleaseContextCoreAsync(
            string recordingMbid,
            MusicBrainzOperationContext context,
            CancellationToken cancellationToken)
    {
        ExternalMetadataResult<ReleasePageResponse> page = await GetReleasePageCoreAsync(
            recordingMbid,
            0,
            context,
            cancellationToken).ConfigureAwait(false);
        if (!page.IsSuccess)
        {
            return Failure<ReleaseContextOutcome>(page.Error);
        }

        if (page.Value.Releases is null)
        {
            return Failure<ReleaseContextOutcome>(InvalidResponse());
        }

        var releases = new List<ReleaseRoute>();
        var warnings = new List<string>();
        IReadOnlyList<ReleaseDto> rows = page.Value.Releases;
        foreach (ReleaseDto release in rows.Take(_options.MaxSourceReleaseLookups))
        {
            if (TryMapReleaseContextRoute(release, out ReleaseRoute route, out bool invalidRows))
            {
                releases.Add(route);
            }

            if (invalidRows)
            {
                AddWarning(warnings, SourceReleaseContextWarning);
            }
        }

        int? total = page.Value.ReleaseCount ?? page.Value.Count;
        bool complete = rows.Count <= _options.MaxSourceReleaseLookups &&
            (total is null || total <= _options.MaxSourceReleaseLookups) &&
            warnings.Count == 0;
        if (!complete)
        {
            AddWarning(warnings, SourceReleaseContextWarning);
        }

        if (total is > 0 && total > _options.MaxSourceReleaseLookups)
        {
            AddWarning(warnings, SourceReleaseLimitWarning);
        }

        return new ExternalMetadataResult<ReleaseContextOutcome>(
            new ReleaseContextOutcome(releases, complete, warnings));
    }

    private async Task<ExternalMetadataResult<ReleaseContextOutcome>>
        BrowseReleaseGroupContextCoreAsync(
            string releaseGroupMbid,
            MusicBrainzOperationContext context,
            CancellationToken cancellationToken)
    {
        ExternalMetadataResult<ReleasePageResponse> page = await GetReleaseGroupPageCoreAsync(
            releaseGroupMbid,
            0,
            context,
            cancellationToken).ConfigureAwait(false);
        if (!page.IsSuccess)
        {
            return Failure<ReleaseContextOutcome>(page.Error);
        }

        if (page.Value.Releases is null)
        {
            return Failure<ReleaseContextOutcome>(InvalidResponse());
        }

        IReadOnlyList<ReleaseDto> rows = page.Value.Releases;
        var releases = new List<ReleaseRoute>();
        var warnings = new List<string>();
        foreach (ReleaseDto release in rows.Take(_options.MaxSourceReleaseLookups))
        {
            if (TryMapReleaseContextRoute(release, out ReleaseRoute route, out bool invalidRows))
            {
                releases.Add(route);
            }

            if (invalidRows)
            {
                AddWarning(warnings, SourceReleaseContextWarning);
            }
        }

        int? total = page.Value.ReleaseCount ?? page.Value.Count;
        bool complete = rows.Count <= _options.MaxSourceReleaseLookups &&
            (total is null || total <= _options.MaxSourceReleaseLookups) &&
            warnings.Count == 0;
        if (!complete)
        {
            AddWarning(warnings, SourceReleaseContextWarning);
        }

        if (total is > 0 && total > _options.MaxSourceReleaseLookups)
        {
            AddWarning(warnings, SourceReleaseLimitWarning);
        }

        return new ExternalMetadataResult<ReleaseContextOutcome>(
            new ReleaseContextOutcome(releases, complete, warnings));
    }

    private static bool TryMapReleaseContextRoute(
        ReleaseDto release,
        out ReleaseRoute route,
        out bool invalidRows)
    {
        return TryMapReleaseRoute(release, null, out route, out invalidRows);
    }
}
