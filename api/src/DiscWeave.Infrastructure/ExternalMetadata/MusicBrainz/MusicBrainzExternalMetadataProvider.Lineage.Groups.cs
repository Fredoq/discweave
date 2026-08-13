using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private async Task<IReadOnlyList<RecordingLineageCandidate>> EnrichReleaseGroupsAsync(
        IReadOnlyList<RecordingLineageCandidate> candidates,
        MusicBrainzOperationContext context,
        CancellationToken cancellationToken)
    {
        RecordingLineageCandidate[] enriched = [.. candidates];
        string[] groupMbids =
        [
            .. candidates
                .SelectMany(candidate => candidate.ReleaseRoutes)
                .Select(route => route.ReleaseGroupSource.ExternalId)
                .Distinct(StringComparer.Ordinal)
        ];
        int loadedCount = Math.Min(groupMbids.Length, _options.MaxReleaseGroupLookups);

        foreach (string omittedGroup in groupMbids.Skip(loadedCount))
        {
            AddCandidateWarnings(
                enriched,
                omittedGroup,
                [GroupContextWarning]);
        }

        for (int index = 0; index < loadedCount; index++)
        {
            string groupMbid = groupMbids[index];
            ExternalMetadataResult<ReleaseGroupDetailOutcome> group = await GetReleaseGroupDetailAsync(
                groupMbid,
                context,
                cancellationToken).ConfigureAwait(false);
            if (group.IsSuccess)
            {
                ApplyGroupContext(
                    enriched,
                    groupMbid,
                    IsForwardRerecordingGroup(group.Value));
                continue;
            }

            if (!IsOperationExhaustion(group.Error))
            {
                AddCandidateWarnings(
                    enriched,
                    groupMbid,
                    [GroupContextWarning]);
                continue;
            }

            foreach (string affectedGroup in groupMbids
                .Skip(index)
                .Take(loadedCount - index))
            {
                AddCandidateWarnings(
                    enriched,
                    affectedGroup,
                    [GroupContextWarning, OperationBudgetExhaustedCode]);
            }

            break;
        }

        return enriched;
    }

    private static void ApplyGroupContext(
        RecordingLineageCandidate[] candidates,
        string groupMbid,
        bool rerecordingContext)
    {
        for (int index = 0; index < candidates.Length; index++)
        {
            RecordingLineageCandidate candidate = candidates[index];
            RecordingReleaseRoute[] routes =
            [
                .. candidate.ReleaseRoutes.Select(route =>
                    string.Equals(
                        route.ReleaseGroupSource.ExternalId,
                        groupMbid,
                        StringComparison.Ordinal)
                            ? route with
                            {
                                ReleaseGroupRerecordingContext = rerecordingContext
                            }
                            : route)
            ];
            candidates[index] = candidate with { ReleaseRoutes = routes };
        }
    }

    private static void AddCandidateWarnings(
        RecordingLineageCandidate[] candidates,
        string groupMbid,
        IReadOnlyList<string> warnings)
    {
        for (int index = 0; index < candidates.Length; index++)
        {
            RecordingLineageCandidate candidate = candidates[index];
            if (!candidate.ReleaseRoutes.Any(route =>
                string.Equals(
                    route.ReleaseGroupSource.ExternalId,
                    groupMbid,
                    StringComparison.Ordinal)))
            {
                continue;
            }

            candidates[index] = candidate with
            {
                Warnings = SortedWarnings(candidate.Warnings.Concat(warnings))
            };
        }
    }
}
