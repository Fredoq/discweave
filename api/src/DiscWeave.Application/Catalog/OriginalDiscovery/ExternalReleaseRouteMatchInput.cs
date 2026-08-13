using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalReleaseRouteMatchInput
{
    public required ExternalMetadataReleaseDetail MusicBrainzRelease { get; init; }
    public required string MusicBrainzMediumPosition { get; init; }
    public required string MusicBrainzTrackMbid { get; init; }
    public required string MusicBrainzRecordingMbid { get; init; }
    public required ExternalMetadataReleaseDetail DiscogsRelease { get; init; }
    public required ExternalReleaseRouteMatchAuthority Authority { get; init; }
}
