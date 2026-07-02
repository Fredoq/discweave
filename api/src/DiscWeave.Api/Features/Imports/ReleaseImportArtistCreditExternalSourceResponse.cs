namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportArtistCreditExternalSourceResponse(
    string ProviderName,
    string ResourceType,
    string ExternalId,
    string SourceUrl);
