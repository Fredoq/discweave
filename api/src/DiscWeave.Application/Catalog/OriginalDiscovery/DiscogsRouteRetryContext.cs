using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record DiscogsRouteRetryContext
{
    public required ExternalMetadataSource RecordingSource { get; init; }
    public required IReadOnlyList<DiscogsRouteRetryItem> Items { get; init; }
}
