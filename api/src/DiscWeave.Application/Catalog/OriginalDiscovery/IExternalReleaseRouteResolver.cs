namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public interface IExternalReleaseRouteResolver
{
    Task<ExternalReleaseRouteBatchResolution> ResolveAsync(
        IReadOnlyList<ExternalReleaseRouteResolutionRequest> candidates,
        CancellationToken cancellationToken);

    Task<ExternalReleaseRouteBatchResolution> RetryAsync(
        DiscogsRouteRetryContext retryContext,
        CancellationToken cancellationToken);
}
