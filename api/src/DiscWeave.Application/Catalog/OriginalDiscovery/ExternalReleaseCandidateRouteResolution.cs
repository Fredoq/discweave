using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalReleaseCandidateRouteResolution
{
    public required ExternalMetadataSource RecordingSource { get; init; }
    public required IReadOnlyList<ExternalReleaseRouteCandidate> Routes { get; init; }
    public required ExternalProviderOperationStatus DiscogsStatus { get; init; }
    public required IReadOnlyList<string> Warnings { get; init; }
    public required DiscogsRouteRetryContext RetryContext { get; init; }
    public required int AttemptedDiscogsRouteCount { get; init; }
    public required int OutboundRequestCount { get; init; }
}
