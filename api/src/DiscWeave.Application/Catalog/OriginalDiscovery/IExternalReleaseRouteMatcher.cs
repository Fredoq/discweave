namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public interface IExternalReleaseRouteMatcher
{
    ExternalReleaseRouteMatchResult Match(
        ExternalReleaseRouteMatchInput input);
}
