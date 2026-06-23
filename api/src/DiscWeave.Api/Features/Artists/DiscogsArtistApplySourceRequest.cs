namespace DiscWeave.Api.Features.Artists;

public sealed record DiscogsArtistApplySourceRequest(
    string ProviderName,
    string ResourceType,
    string ExternalId,
    string SourceUrl);
