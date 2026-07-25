using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalOriginalCandidate
{
    public required string CandidateKey { get; init; }
    public TrackId? LocalTrackId { get; init; }
    public required ExternalMetadataSource RecordingSource { get; init; }
    public required string Title { get; init; }
    public required IReadOnlyList<string> Artists { get; init; }
    public required RankedOriginalCandidate Ranked { get; init; }
    public string? SuggestedRelationTypeCode { get; init; }
    public required IReadOnlyList<RecordingReleaseRoute> ReleaseRoutes { get; init; }
}
