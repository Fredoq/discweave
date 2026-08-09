using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private static IReadOnlyList<RecordingLineageCandidate> MergeCandidates(
        IEnumerable<RecordingLineageCandidate> candidates)
    {
        return
        [
            .. candidates
                .GroupBy(candidate => candidate.RecordingSource.ExternalId, StringComparer.Ordinal)
                .Select(group =>
                {
                    RecordingLineageCandidate primary = group
                        .OrderByDescending(candidate => candidate.Relations.Count > 0)
                        .ThenBy(candidate => candidate.DiscoveryContext?.Role ?? OriginalCandidateRole.Diagnostic)
                        .First();
                    RecordingDiscoveryContext? context = MergeDiscoveryContexts(
                        group.Select(candidate => candidate.DiscoveryContext));
                    return primary with
                    {
                        Relations =
                        [
                            .. group.SelectMany(candidate => candidate.Relations)
                                .DistinctBy(relation =>
                                    $"{relation.SelectedRecordingMbid}:{relation.CandidateRecordingMbid}:{relation.Kind}:{relation.Direction}")
                        ],
                        WorkEvidence =
                        [
                            .. group.SelectMany(candidate => candidate.WorkEvidence)
                                .GroupBy(evidence => evidence.WorkMbid, StringComparer.Ordinal)
                                .Select(work => new RecordingWorkEvidence
                                {
                                    WorkMbid = work.Key,
                                    ExplicitCover = work.Any(evidence => evidence.ExplicitCover)
                                })
                        ],
                        ReleaseRoutes =
                        [
                            .. group.SelectMany(candidate => candidate.ReleaseRoutes)
                                .DistinctBy(route =>
                                    $"{route.ReleaseSource.ExternalId}:{route.MusicBrainzTrackMbid}:{route.MediumPosition}")
                        ],
                        ChronologyComplete = group.All(candidate => candidate.ChronologyComplete),
                        Warnings = SortedWarnings(group.SelectMany(candidate => candidate.Warnings)),
                        DiscoveryContext = context
                    };
                })
        ];
    }

    private static RecordingDiscoveryContext? MergeDiscoveryContexts(
        IEnumerable<RecordingDiscoveryContext?> contexts)
    {
        RecordingDiscoveryContext[] present =
        [.. contexts.Where(context => context is not null).Select(context => context!)];
        return present.Length == 0
            ? null
            : new RecordingDiscoveryContext
            {
                Role = present.Min(context => context.Role),
                Paths = new HashSet<OriginalDiscoveryPath>(present.SelectMany(context => context.Paths)),
                Evidence =
                [
                    .. present.SelectMany(context => context.Evidence)
                        .DistinctBy(evidence => $"{evidence.Code}:{evidence.Kind}:{evidence.Channel}")
                ],
                StructuralEvidenceComplete = present.All(context => context.StructuralEvidenceComplete)
            };
    }
}
