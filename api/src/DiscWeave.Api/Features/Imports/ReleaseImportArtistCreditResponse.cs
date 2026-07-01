namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportArtistCreditResponse(
    Guid? ArtistId,
    string Name,
    string Role,
    ReleaseImportArtistCreditExternalSourceResponse? ExternalSource = null);

public sealed record ReleaseImportArtistCreditExternalSourceResponse(
    string ProviderName,
    string ResourceType,
    string ExternalId,
    string SourceUrl);
