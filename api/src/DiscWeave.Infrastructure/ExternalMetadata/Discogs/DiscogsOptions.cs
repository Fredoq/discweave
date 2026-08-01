namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed class DiscogsOptions
{
    public string BaseUrl { get; init; } = "https://api.discogs.com";

    public string UserAgent { get; init; } = "DiscWeave/0.1 (+https://github.com/Fredoq/discweave)";

    public int TimeoutSeconds { get; init; } = 10;

    public int MaxOriginalRouteLookups { get; init; } = 5;

    public int MaxOriginalSearchResultsPerRoute { get; init; } = 3;

    public int MaxOriginalRequestsPerRoute { get; init; } = 12;

    public int MaxOriginalRequestsPerDiscovery { get; init; } = 25;

    public int OriginalDiscoveryTimeoutSeconds { get; init; } = 30;
}
