namespace DiscWeave.Application.ExternalMetadata;

public interface IDiscogsLabelCatalogProvider
{
    Task<ExternalMetadataResult<ExternalMetadataSearchResult<DiscogsLabelCandidate>>> SearchLabelsAsync(string query, CancellationToken cancellationToken);
    Task<ExternalMetadataResult<DiscogsLabelCandidate>> GetLabelAsync(string externalId, CancellationToken cancellationToken);
    Task<ExternalMetadataResult<DiscogsLabelCatalogPage>> GetLabelReleasesAsync(string externalId, int page, CancellationToken cancellationToken);
}
