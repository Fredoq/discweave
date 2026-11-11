namespace DiscWeave.Application.ExternalMetadata;

public interface IDiscogsLabelCatalogProvider
{
    Task<ExternalMetadataResult<ExternalMetadataSearchResult<DiscogsLabelCandidate>>> SearchLabelsAsync(string query, CancellationToken cancellationToken);
    Task<ExternalMetadataResult<DiscogsLabelCandidate>> GetLabelAsync(string externalId, CancellationToken cancellationToken);
    Task<ExternalMetadataResult<DiscogsLabelCatalogPage>> GetLabelReleasesAsync(string externalId, int page, CancellationToken cancellationToken);
}

public sealed record DiscogsLabelCandidate(string ExternalId, string Name);
public sealed record DiscogsLabelCatalogItem(string ExternalId, string CatalogNumber, string Artist, string Title, int Year, string Format);
public sealed record DiscogsLabelCatalogPage(IReadOnlyList<DiscogsLabelCatalogItem> Items, int Page, int PageSize, int Total, int Pages);
