using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Features.Tracks;

public sealed partial class ExternalOriginalCandidateService
{
    private static IReadOnlyList<ExternalOriginalCandidate> MapCandidates(
        LocalOriginalCandidateResult local,
        IReadOnlyList<RecordingLineageResult> results)
    {
        LocalOriginalSourceFacts source = local.Source
            ?? throw new InvalidOperationException(
                "Successful local original discovery must include source facts");
        HashSet<Guid> sourceRecordingIds = SourceRecordingIds(
            source,
            results);
        CandidateMappingWorkItem[] workItems =
        [
            .. results
                .SelectMany(result => result.Candidates)
                .Select(candidate =>
                    TryRecordingId(candidate.RecordingSource, out Guid id)
                        ? new CandidateMappingWorkItem(id, candidate)
                        : null)
                .OfType<CandidateMappingWorkItem>()
                .Where(item => !sourceRecordingIds.Contains(item.RecordingId))
        ];
        List<CandidateAggregate> aggregates =
        [
            .. workItems
                .GroupBy(item => item.RecordingId)
                .Select(group => Aggregate(group.Key, group))
                .Where(HasRetainedCandidateEvidence)
        ];
        OriginalCandidateInput[] inputs =
        [
            .. aggregates.Select(aggregate =>
                ToRankerInput(source, aggregate))
        ];
        IReadOnlyList<RankedOriginalCandidate> ranked =
            OriginalCandidateRanker.Rank(inputs);
        var byKey =
            aggregates.ToDictionary(aggregate => aggregate.CandidateKey);

        return
        [
            .. ranked.Select(candidate =>
                ToCandidate(
                    local,
                    byKey[candidate.CandidateKey],
                    candidate))
        ];
    }

    private static CandidateAggregate Aggregate(
        Guid recordingId,
        IEnumerable<CandidateMappingWorkItem> workItems)
    {
        RecordingLineageCandidate[] candidates =
        [
            .. workItems
                .Select(item => item.Candidate)
                .OrderByDescending(candidate => candidate.Relations.Count > 0)
                .ThenBy(candidate => candidate.DiscoveryContext?.Role ?? OriginalCandidateRole.Diagnostic)
                .ThenBy(candidate => candidate.Title, StringComparer.Ordinal)
                .ThenBy(candidate =>
                    string.Join('\u001f', candidate.Artists),
                    StringComparer.Ordinal)
                .ThenBy(candidate => candidate.Duration?.Ticks ?? long.MaxValue)
        ];
        RecordingLineageCandidate primary = candidates[0];
        RecordingLineageRelation[] relations =
        [
            .. candidates
                .SelectMany(candidate => candidate.Relations)
                .Where(relation =>
                    RelationTargets(relation, recordingId))
                .Distinct()
        ];
        RecordingReleaseRoute[] routes =
        [
            .. MergeRoutes(
                candidates.SelectMany(candidate =>
                    candidate.ReleaseRoutes))
        ];
        return new CandidateAggregate
        {
            RecordingId = recordingId,
            RecordingSource = CanonicalRecordingSource(
                primary.RecordingSource,
                recordingId),
            Title = primary.Title,
            Artists = primary.Artists,
            Duration = primary.Duration,
            Relations = relations,
            WorkEvidence =
                [.. candidates
                    .SelectMany(candidate => candidate.WorkEvidence)
                    .GroupBy(evidence => evidence.WorkMbid, StringComparer.Ordinal)
                    .Select(work => new RecordingWorkEvidence
                    {
                        WorkMbid = work.Key,
                        ExplicitCover = work.Any(evidence => evidence.ExplicitCover)
                    })],
            ReleaseRoutes = routes,
            ChronologyComplete =
                candidates.All(candidate => candidate.ChronologyComplete),
            DiscoveryContext = MergeDiscoveryContexts(
                candidates.Select(candidate => candidate.DiscoveryContext))
        };
    }

    private static OriginalCandidateInput ToRankerInput(
        LocalOriginalSourceFacts source,
        CandidateAggregate aggregate)
    {
        bool directed = HasRetainedForwardRelation(aggregate);
        HashSet<OriginalCandidateHardGate> hardGates = [];
        if (aggregate.WorkEvidence.Any(evidence => evidence.ExplicitCover))
        {
            _ = hardGates.Add(OriginalCandidateHardGate.ExplicitCover);
        }

        if (aggregate.Relations.Any(relation =>
            relation.Direction
                == RecordingLineageDirection.CandidateToSelected))
        {
            _ = hardGates.Add(
                OriginalCandidateHardGate.ReversedDirectedLineage);
        }

        OriginalCandidateChronology? chronology =
            CandidateChronology(aggregate);
        OriginalVersionClassification sourceClassification =
            OriginalVersionClassifier.Classify(source.Title);
        OriginalVersionClassification candidateClassification =
            OriginalVersionClassifier.Classify(aggregate.Title);
        RecordingDiscoveryContext? discovery = aggregate.DiscoveryContext;
        var facts = new OriginalCandidateFacts
        {
            CandidateKey = aggregate.CandidateKey,
            SourceBaseTitle = source.BaseTitle,
            CandidateBaseTitle = candidateClassification.BaseTitle,
            SourcePrimaryArtist =
                source.Artists.Count > 0 ? source.Artists[0] : null,
            CandidatePrimaryArtist =
                aggregate.Artists.Count > 0 ? aggregate.Artists[0] : null,
            SourceDuration = source.Duration,
            CandidateDuration = aggregate.Duration,
            SourceChronology = source.ApproximateYear is { } year
                ? OriginalCandidateChronology.FromYear(year, complete: true)
                : null,
            CandidateChronology = chronology,
            DirectedLineage = directed,
            KnownLocalRoot = false,
            VersionMarker = HasVersionMarker(source),
            CreditsSupport = false,
            HardGates = hardGates,
            AdditionalEvidence = discovery?.Evidence ?? [],
            SourceClassification = sourceClassification,
            CandidateClassification = candidateClassification,
            CandidateRole = discovery?.Role ?? OriginalCandidateRole.Diagnostic,
            StructuralEvidenceComplete = discovery?.StructuralEvidenceComplete ?? aggregate.ChronologyComplete
        };
        OriginalCandidateInput extracted =
            OriginalCandidateEvidenceExtractor.Extract(facts);
        return new OriginalCandidateInput
        {
            CandidateKey = extracted.CandidateKey,
            CandidateChronology = extracted.CandidateChronology,
            Evidence =
            [
                .. extracted.Evidence.Select(ToExternalEvidence)
            ],
            HardGates = extracted.HardGates,
            CandidateRole = extracted.CandidateRole
        };
    }

}
