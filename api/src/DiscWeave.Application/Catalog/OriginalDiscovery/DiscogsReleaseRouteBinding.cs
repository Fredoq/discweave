using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record DiscogsReleaseRouteBinding
{
    public required ExternalMetadataSource ReleaseSource { get; init; }
    public required int RowOrdinal { get; init; }
    public required string Position { get; init; }
    public required string Fingerprint { get; init; }
}
