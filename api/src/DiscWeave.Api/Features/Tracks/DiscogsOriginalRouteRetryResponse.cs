namespace DiscWeave.Api.Features.Tracks;

public sealed record DiscogsOriginalRouteRetryResponse
{
    public required IReadOnlyList<ExternalOriginalCandidateReleaseRouteResponse> Routes { get; init; }

    public required
        ExternalOriginalCandidateProviderStatusResponse DiscogsStatus
    {
        get;
        init;
    }

    public required IReadOnlyList<string> DiscogsWarnings { get; init; }

    public required
        DiscogsOriginalRouteRetryRequest.ContextData DiscogsRetryContext
    {
        get;
        init;
    }

    public required int AttemptedDiscogsRouteCount { get; init; }

    public required int OutboundRequestCount { get; init; }
}
