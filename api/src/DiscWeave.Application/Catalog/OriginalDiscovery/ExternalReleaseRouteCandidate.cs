namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalReleaseRouteCandidate
{
    public required RecordingReleaseRoute MusicBrainzRoute { get; init; }
    public DiscogsReleaseRouteBinding? DiscogsBinding { get; init; }
    public required bool IsPreferred { get; init; }
    public required IReadOnlyList<string> EvidenceCodes { get; init; }
}
