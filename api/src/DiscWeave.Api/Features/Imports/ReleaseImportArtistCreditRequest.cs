namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportArtistCreditRequest(
    Guid? ArtistId,
    string? Name,
    string? Role,
    ReleaseImportArtistCreditExternalSourceRequest? ExternalSource = null);

public sealed record ReleaseImportArtistCreditExternalSourceRequest(
    string? ProviderName,
    string? ResourceType,
    string? ExternalId,
    string? SourceUrl);
