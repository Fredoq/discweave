using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record LocalOriginalSourceFacts
{
    public required TrackId TrackId { get; init; }
    public required string Title { get; init; }
    public required string BaseTitle { get; init; }
    public required IReadOnlyList<string> Artists { get; init; }
    public TimeSpan? Duration { get; init; }
    public int? ApproximateYear { get; init; }
    public ExternalMetadataSource? RecordingSource { get; init; }
}
