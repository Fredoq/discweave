namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public interface IDiscogsIntegrationSettingsStore : IDiscogsAccessTokenProvider
{
    Task<bool> IsConfiguredAsync(CancellationToken cancellationToken);

    Task SaveAccessTokenAsync(string accessToken, CancellationToken cancellationToken);

    Task ClearAccessTokenAsync(CancellationToken cancellationToken);
}
