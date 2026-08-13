using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record LocalOriginalCandidate
{
    public required string CandidateKey { get; init; }
    public required TrackId LocalTrackId { get; init; }
    public required string Title { get; init; }
    public required string ArtistDisplay { get; init; }
    public TimeSpan? Duration { get; init; }
    public int? VersionYear { get; init; }
    public required bool IsExistingRoot { get; init; }
    public required int MemberCount { get; init; }
    public required bool RequiresPromotion { get; init; }
    public string? SuggestedRelationTypeCode { get; init; }
    public ExternalMetadataSource? RecordingSource { get; init; }
    public required RankedOriginalCandidate Ranked { get; init; }
}
