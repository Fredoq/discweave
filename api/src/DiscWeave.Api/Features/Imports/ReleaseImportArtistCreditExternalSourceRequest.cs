namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportArtistCreditExternalSourceRequest(
    string? ProviderName,
    string? ResourceType,
    string? ExternalId,
    string? SourceUrl);
