using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record DiscogsRouteRetryItem
{
    public required RecordingReleaseRoute Route { get; init; }
    public required ExternalMetadataReleaseDetail MusicBrainzRelease { get; init; }
}
