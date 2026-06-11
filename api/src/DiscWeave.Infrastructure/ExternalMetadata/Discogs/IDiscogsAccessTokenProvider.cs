namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public interface IDiscogsAccessTokenProvider
{
    Task<string?> GetAccessTokenAsync(CancellationToken cancellationToken);
}
