using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed partial class LocalOriginalCandidateService
{
    private static bool HasDirectedLineage(
        LocalOriginalCandidateSnapshot snapshot,
        CollectionId collectionId,
        TrackId sourceTrackId,
        TrackId candidateTrackId,
        string? relationTypeCode)
    {
        return relationTypeCode is not null
            && HasRelation(
                snapshot,
                collectionId,
                sourceTrackId,
                candidateTrackId,
                relationTypeCode,
                eitherDirection: false);
    }

    private static bool HasRelation(
        LocalOriginalCandidateSnapshot snapshot,
        CollectionId collectionId,
        TrackId sourceTrackId,
        TrackId targetTrackId,
        string relationTypeCode,
        bool eitherDirection)
    {
        return snapshot.StackRelations.Any(relation =>
            relation.CollectionId == collectionId
            && string.Equals(
                relation.RelationTypeCode,
                relationTypeCode,
                StringComparison.Ordinal)
            && ((relation.SourceTrackId == sourceTrackId
                    && relation.TargetTrackId == targetTrackId)
                || (eitherDirection
                    && relation.SourceTrackId == targetTrackId
                    && relation.TargetTrackId == sourceTrackId)));
    }

    private static bool HasExactRecordingIdentity(
        ExternalMetadataSource? source,
        ExternalMetadataSource? candidate)
    {
        return IsMusicBrainzRecording(source)
            && IsMusicBrainzRecording(candidate)
            && Guid.TryParse(source!.ExternalId, out Guid sourceId)
            && Guid.TryParse(candidate!.ExternalId, out Guid candidateId)
            && sourceId == candidateId;
    }

    private static bool IsMusicBrainzRecording(
        ExternalMetadataSource? source)
    {
        return source is not null
            && string.Equals(
                source.ProviderName,
                "musicbrainz",
                StringComparison.OrdinalIgnoreCase)
            && string.Equals(
                source.ResourceType,
                "recording",
                StringComparison.OrdinalIgnoreCase);
    }

    private static LocalOriginalCandidate ToCandidate(
        CandidateWorkItem workItem,
        RankedOriginalCandidate ranked)
    {
        LocalOriginalCandidateSnapshot.CandidateTrackFact candidate =
            workItem.Candidate;
        return new LocalOriginalCandidate
        {
            CandidateKey = ranked.CandidateKey,
            LocalTrackId = candidate.TrackId,
            Title = candidate.Title,
            ArtistDisplay = workItem.CandidateArtistDisplay,
            Duration = candidate.Duration,
            VersionYear = candidate.VersionYear,
            IsExistingRoot = workItem.IsExistingRoot,
            MemberCount = workItem.MemberCount,
            RequiresPromotion = !candidate.IsOriginal,
            SuggestedRelationTypeCode =
                workItem.SuggestedRelationTypeCode,
            RecordingSource = candidate.RecordingSource,
            Ranked = ranked
        };
    }

    private static LocalOriginalCandidateResult Result(
        LocalOriginalCandidateStatus status,
        TrackId sourceTrackId,
        LocalOriginalSourceFacts? source,
        IReadOnlyList<LocalOriginalCandidate> candidates)
    {
        return new LocalOriginalCandidateResult
        {
            Status = status,
            SourceTrackId = sourceTrackId,
            Source = source,
            Candidates = candidates
        };
    }

    private static string? EmptyToNull(string value)
    {
        return value.Length == 0 ? null : value;
    }

    private sealed record MarkerFacts
    {
        public required string BaseTitle { get; init; }
        public required bool HasMarker { get; init; }
        public string? RelationTypeCode { get; init; }
        public string? SuggestedRelationTypeCode { get; init; }

        public static MarkerFacts None(string title)
        {
            return new MarkerFacts
            {
                BaseTitle = title,
                HasMarker = false,
                RelationTypeCode = null,
                SuggestedRelationTypeCode = null
            };
        }
    }

    private sealed record CandidateWorkItem
    {
        public required LocalOriginalCandidateSnapshot.CandidateTrackFact Candidate { get; init; }
        public required string CandidateArtistDisplay { get; init; }
        public required bool IsExistingRoot { get; init; }
        public required int MemberCount { get; init; }
        public string? SuggestedRelationTypeCode { get; init; }
        public required OriginalCandidateInput Input { get; init; }
    }
}
