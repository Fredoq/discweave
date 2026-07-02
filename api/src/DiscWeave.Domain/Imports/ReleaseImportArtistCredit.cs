namespace DiscWeave.Domain.Imports;

public sealed record ReleaseImportArtistCredit(
    Guid? ArtistId,
    string Name,
    string Role,
    ReleaseImportArtistCreditExternalSource? ExternalSource = null);

public sealed record ReleaseImportArtistCreditExternalSource(
    string ProviderName,
    string ResourceType,
    string ExternalId,
    string SourceUrl);
