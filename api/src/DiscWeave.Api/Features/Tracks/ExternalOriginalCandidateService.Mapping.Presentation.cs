using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Tracks;

public sealed partial class ExternalOriginalCandidateService
{
    private static ExternalOriginalCandidate ToCandidate(
        LocalOriginalCandidateResult local,
        CandidateAggregate aggregate,
        RankedOriginalCandidate ranked)
    {
        TrackId? localTrackId = local.Candidates
            .Where(candidate =>
                candidate.Ranked.Confidence == OriginalCandidateConfidence.Medium
                && TryRecordingId(candidate.RecordingSource, out Guid recordingId)
                && recordingId == aggregate.RecordingId)
            .OrderBy(candidate => candidate.LocalTrackId.Value.ToString("D").ToLowerInvariant(), StringComparer.Ordinal)
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
            InferenceComplete = aggregate.DiscoveryContext?.StructuralEvidenceComplete ?? aggregate.ChronologyComplete,
            DiscoveryPaths = aggregate.DiscoveryContext?.Paths ?? new HashSet<OriginalDiscoveryPath>(),
            SuggestedRelationTypeCode =
                SuggestedRelationType(aggregate.Relations)
                ?? local.Source?.SuggestedRelationTypeCode,
            ReleaseRoutes =
            [
                .. aggregate.ReleaseRoutes.Select(route => new ExternalReleaseRouteCandidate
                {
                    MusicBrainzRoute = route,
                    DiscogsBinding = null,
                    IsPreferred = false,
                    EvidenceCodes = ["musicbrainz.release_route"]
                })
            ],
            DiscogsStatus = new ExternalProviderOperationStatus
            {
                ProviderCode = "discogs",
                Outcome = ExternalProviderOperationOutcome.Succeeded
            },
            DiscogsWarnings = [],
            DiscogsRetryContext = new DiscogsRouteRetryContext
            {
                RecordingSource = aggregate.RecordingSource,
                Items = []
            }
        };
    }

    private static RecordingDiscoveryContext? MergeDiscoveryContexts(
        IEnumerable<RecordingDiscoveryContext?> contexts)
    {
        RecordingDiscoveryContext[] present =
        [.. contexts.Where(context => context is not null).Select(context => context!)]; // NOSONAR: filtered nullable contexts are present.
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

    private static OriginalCandidateEvidence ToExternalEvidence(OriginalCandidateEvidence evidence)
    {
        return evidence.Code is OriginalCandidateEvidenceCode.VersionMarker
            or OriginalCandidateEvidenceCode.MissingVersionMarker
            ? evidence
            : evidence with { Channel = OriginalCandidateEvidenceChannel.MusicBrainz };
    }

    private static OriginalCandidateChronology? CandidateChronology(CandidateAggregate aggregate)
    {
        return aggregate.ReleaseRoutes
            .Select(route => ToChronology(route.Date, aggregate.ChronologyComplete))
            .Where(chronology => chronology is not null)
            .OrderBy(chronology => chronology!.LowerBound) // NOSONAR: null chronologies were filtered above.
            .ThenBy(chronology => chronology!.UpperBound) // NOSONAR: null chronologies were filtered above.
            .FirstOrDefault();
    }

    // Keep this guard clause explicit: chronology validation has multiple nullable branches below.
#pragma warning disable IDE0046
    private static OriginalCandidateChronology? ToChronology(ProviderPartialDate? date, bool complete)
    {
        if (date is null || date.Year is < 1 or > 9999)
        {
            return null;
        }

        return date.Month is null
            ? date.Day is null
            ? OriginalCandidateChronology.FromYear(date.Year, complete)
            : null
            : date.Month is < 1 or > 12
            ? null
            : date.Day is null
            ? OriginalCandidateChronology.FromMonth(date.Year, date.Month.Value, complete)
            : DateOnly.TryParseExact(
            $"{date.Year:D4}-{date.Month:D2}-{date.Day:D2}",
            "yyyy-MM-dd",
            CultureInfo.InvariantCulture,
            DateTimeStyles.None,
            out DateOnly day)
            ? OriginalCandidateChronology.FromDay(day, complete)
            : null;
    }
#pragma warning restore IDE0046
}
