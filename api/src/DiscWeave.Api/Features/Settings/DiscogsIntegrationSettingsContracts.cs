namespace DiscWeave.Api.Features.Settings;

public sealed record DiscogsIntegrationStatusResponse(
    string ProviderName,
    bool Enabled,
    bool Configured);

public sealed record DiscogsAccessTokenRequest(string? AccessToken);
