using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.SharedKernel.Ids;

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
                .Where(item => item is not null)
                .Cast<CandidateMappingWorkItem>()
                .Where(item => !sourceRecordingIds.Contains(item.RecordingId))
        ];
        List<CandidateAggregate> aggregates =
        [
            .. workItems
                .GroupBy(item => item.RecordingId)
                .Select(group => Aggregate(group.Key, group))
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
                .OrderBy(candidate => candidate.Title, StringComparer.Ordinal)
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
            .. candidates
                .SelectMany(candidate => candidate.ReleaseRoutes)
                .GroupBy(RouteKey, StringComparer.Ordinal)
                .Select(group => group.First())
                .OrderBy(RouteKey, StringComparer.Ordinal)
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
                [.. candidates.SelectMany(candidate => candidate.WorkEvidence)],
            ReleaseRoutes = routes,
            ChronologyComplete =
                candidates.All(candidate => candidate.ChronologyComplete)
        };
    }

    private static OriginalCandidateInput ToRankerInput(
        LocalOriginalSourceFacts source,
        CandidateAggregate aggregate)
    {
        bool directed = aggregate.Relations.Any(relation =>
            relation.Direction
                == RecordingLineageDirection.SelectedToCandidate);
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
        var facts = new OriginalCandidateFacts
        {
            CandidateKey = aggregate.CandidateKey,
            SourceBaseTitle = source.BaseTitle,
            CandidateBaseTitle = aggregate.Title,
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
            AdditionalEvidence = []
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
            HardGates = extracted.HardGates
        };
    }

    private static ExternalOriginalCandidate ToCandidate(
        LocalOriginalCandidateResult local,
        CandidateAggregate aggregate,
        RankedOriginalCandidate ranked)
    {
        TrackId? localTrackId = local.Candidates
            .Where(candidate =>
                candidate.Ranked.Confidence
                    == OriginalCandidateConfidence.Medium
                && TryRecordingId(
                    candidate.RecordingSource,
                    out Guid recordingId)
                && recordingId == aggregate.RecordingId)
            .OrderBy(candidate =>
                candidate.LocalTrackId.Value
                    .ToString("D")
                    .ToLowerInvariant(),
                StringComparer.Ordinal)
            .Select(candidate => (TrackId?)candidate.LocalTrackId)
            .FirstOrDefault();
        return new ExternalOriginalCandidate
        {
            CandidateKey = aggregate.CandidateKey,
            LocalTrackId = localTrackId,
            RecordingSource = aggregate.RecordingSource,
            Title = aggregate.Title,
            Artists = aggregate.Artists,
            Ranked = ranked,
            SuggestedRelationTypeCode =
                SuggestedRelationType(aggregate.Relations),
            ReleaseRoutes = aggregate.ReleaseRoutes
        };
    }

    private static OriginalCandidateEvidence ToExternalEvidence(
        OriginalCandidateEvidence evidence)
    {
        return evidence.Code is OriginalCandidateEvidenceCode.VersionMarker
            or OriginalCandidateEvidenceCode.MissingVersionMarker
            ? evidence
            : evidence with
            {
                Channel = OriginalCandidateEvidenceChannel.MusicBrainz
            };
    }

    private static OriginalCandidateChronology? CandidateChronology(
        CandidateAggregate aggregate)
    {
        return aggregate.ReleaseRoutes
            .Select(route => ToChronology(
                route.Date,
                aggregate.ChronologyComplete))
            .Where(chronology => chronology is not null)
            .OrderBy(chronology => chronology!.LowerBound)
            .ThenBy(chronology => chronology!.UpperBound)
            .FirstOrDefault();
    }

    private static OriginalCandidateChronology? ToChronology(
        ProviderPartialDate? date,
        bool complete)
    {
        return date is null || date.Year is < 1 or > 9999
            ? null
            : date.Month is null
            ? date.Day is null
                ? OriginalCandidateChronology.FromYear(date.Year, complete)
                : null
            : date.Month is < 1 or > 12
            ? null
            : date.Day is null
                ? OriginalCandidateChronology.FromMonth(
                    date.Year,
                    date.Month.Value,
                    complete)
                : DateOnly.TryParseExact(
                    $"{date.Year:D4}-{date.Month:D2}-{date.Day:D2}",
                    "yyyy-MM-dd",
                    CultureInfo.InvariantCulture,
                    DateTimeStyles.None,
                    out DateOnly day)
                    ? OriginalCandidateChronology.FromDay(day, complete)
                    : null;
    }
}
