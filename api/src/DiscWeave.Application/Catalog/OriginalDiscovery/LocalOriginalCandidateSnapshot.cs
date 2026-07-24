using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record LocalOriginalCandidateSnapshot
{
    public SourceTrackFact? Source { get; init; }
    public required IReadOnlyList<CandidateTrackFact> Candidates { get; init; }
    public required IReadOnlyList<StackTrackFact> StackTracks { get; init; }
    public required IReadOnlyList<StackRelationFact> StackRelations { get; init; }
    public required IReadOnlyList<AppearanceFact> Appearances { get; init; }
    public required IReadOnlyList<PrimaryArtistFact> PrimaryArtists { get; init; }
    public required IReadOnlyList<CreditFact> Credits { get; init; }
    public required IReadOnlyList<string> EnabledStackRelationTypeCodes { get; init; }
    public required IReadOnlyList<ParserRuleFact> ParserRules { get; init; }

    public sealed record SourceTrackFact
    {
        public required CollectionId CollectionId { get; init; }
        public required TrackId TrackId { get; init; }
        public required string Title { get; init; }
        public TimeSpan? Duration { get; init; }
        public int? VersionYear { get; init; }
        public required bool IsOriginal { get; init; }
        public ExternalMetadataSource? RecordingSource { get; init; }
    }

    public sealed record CandidateTrackFact
    {
        public required CollectionId CollectionId { get; init; }
        public required TrackId TrackId { get; init; }
        public required string Title { get; init; }
        public TimeSpan? Duration { get; init; }
        public int? VersionYear { get; init; }
        public required bool IsOriginal { get; init; }
        public ExternalMetadataSource? RecordingSource { get; init; }
    }

    public sealed record StackTrackFact
    {
        public required CollectionId CollectionId { get; init; }
        public required TrackId TrackId { get; init; }
        public required string Title { get; init; }
        public required bool IsOriginal { get; init; }
    }

    public sealed record StackRelationFact
    {
        public required CollectionId CollectionId { get; init; }
        public required TrackId SourceTrackId { get; init; }
        public required TrackId TargetTrackId { get; init; }
        public required string RelationTypeCode { get; init; }
    }

    public sealed record AppearanceFact
    {
        public required CollectionId CollectionId { get; init; }
        public required TrackId TrackId { get; init; }
        public DateOnly? ReleaseDate { get; init; }
        public int? ReleaseYear { get; init; }
    }

    public sealed record PrimaryArtistFact
    {
        public required CollectionId CollectionId { get; init; }
        public required TrackId TrackId { get; init; }
        public required string DisplayName { get; init; }
    }

    public sealed record CreditFact
    {
        public required CollectionId CollectionId { get; init; }
        public required TrackId TrackId { get; init; }
        public required string RoleCode { get; init; }
        public required string ContributorName { get; init; }
    }

    public sealed record ParserRuleFact
    {
        public required TrackRelationParserRuleId RuleId { get; init; }
        public required string RelationTypeCode { get; init; }
        public required string Alias { get; init; }
        public required TrackRelationParserRuleMatchMode MatchMode { get; init; }
        public required int Confidence { get; init; }
        public required TrackRelationParserRuleDirection Direction { get; init; }
        public required int SortOrder { get; init; }
        public required bool IsActive { get; init; }
    }
}
