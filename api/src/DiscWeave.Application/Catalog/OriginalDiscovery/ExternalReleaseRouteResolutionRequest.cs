using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalReleaseRouteResolutionRequest
{
    public required ExternalMetadataSource RecordingSource { get; init; }
    public required IReadOnlyList<RecordingReleaseRoute> MusicBrainzRoutes { get; init; }
}
