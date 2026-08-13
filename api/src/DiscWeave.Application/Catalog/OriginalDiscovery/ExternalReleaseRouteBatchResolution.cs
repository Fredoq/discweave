namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalReleaseRouteBatchResolution
{
    public required IReadOnlyList<ExternalReleaseCandidateRouteResolution> Candidates { get; init; }
    public required ExternalProviderOperationStatus DiscogsStatus { get; init; }
    public required int AttemptedDiscogsRouteCount { get; init; }
    public required int OutboundRequestCount { get; init; }
    public required IReadOnlyList<string> Warnings { get; init; }
}
