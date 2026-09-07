namespace DiscWeave.Api.Features.Imports;

public sealed record ExternalReleaseDraftRequest
{
    public required Guid SourceTrackId { get; init; }

    public Guid RecordingMbid { get; init; }

    public MusicBrainzReleaseRowLocatorRequest? MusicBrainzRow { get; init; }

    public DiscogsReleaseRouteRequest? DiscogsRoute { get; init; }

    public required string ReviewedRelationTypeCode { get; init; }

    public required string IdempotencyKey { get; init; }
}
