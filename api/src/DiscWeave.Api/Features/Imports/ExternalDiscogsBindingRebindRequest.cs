namespace DiscWeave.Api.Features.Imports;

public sealed record ExternalDiscogsBindingRebindRequest
{
    public required Guid RecordingMbid { get; init; }

    public required MusicBrainzReleaseRowLocatorRequest MusicBrainzRow { get; init; }

    public required DiscogsReleaseRouteRequest DiscogsRoute { get; init; }

    public required long ExpectedReviewRevision { get; init; }
}
