namespace DiscWeave.Api.Features.Tracks;

public sealed record DiscogsReleaseRouteBindingResponse
{
    public required ExternalOriginalCandidateSourceResponse ReleaseSource { get; init; }

    public required int RowOrdinal { get; init; }

    public required string Position { get; init; }

    public required string Fingerprint { get; init; }
}
