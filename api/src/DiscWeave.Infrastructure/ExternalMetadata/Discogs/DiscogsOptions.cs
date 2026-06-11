namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed class DiscogsOptions
{
    public string BaseUrl { get; init; } = "https://api.discogs.com";

    public string UserAgent { get; init; } = "DiscWeave/0.1 (+https://github.com/Fredoq/discweave)";

    public int TimeoutSeconds { get; init; } = 10;
}
