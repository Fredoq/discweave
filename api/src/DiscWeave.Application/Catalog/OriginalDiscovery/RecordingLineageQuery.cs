using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record RecordingLineageQuery
{
    public required string Title { get; init; }
    public required IReadOnlyList<string> Artists { get; init; }
    public TimeSpan? Duration { get; init; }
    public int? ApproximateYear { get; init; }
    public ExternalMetadataSource? KnownRecording { get; init; }
}
