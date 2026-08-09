namespace DiscWeave.Api.Features.Imports;

public sealed record DiscogsReleaseRouteRequest
{
    public required string ReleaseId { get; init; }

    public required int RowOrdinal { get; init; }

    public required string Position { get; init; }

    public required string Fingerprint { get; init; }
}
