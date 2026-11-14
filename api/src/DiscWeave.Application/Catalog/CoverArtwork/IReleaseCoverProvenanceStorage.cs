namespace DiscWeave.Application.Catalog.CoverArtwork;

public interface IReleaseCoverProvenanceStorage
{
    Task SaveAsync(string storageKey, CoverArtworkProvenance provenance, CancellationToken cancellationToken);
    Task<CoverArtworkProvenance?> ReadAsync(string storageKey, CancellationToken cancellationToken);
}
