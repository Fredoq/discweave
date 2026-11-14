namespace DiscWeave.Application.Catalog.CoverArtwork;

public interface IExternalCoverArtworkProvider
{
    Task<IReadOnlyList<CoverReleaseCandidate>> SearchReleasesAsync(CoverReleaseSearchQuery query, CancellationToken cancellationToken);
    Task<IReadOnlyList<CoverArtworkCandidate>> GetFrontCoversAsync(Guid releaseId, CancellationToken cancellationToken);
    Task<DownloadedCoverArtwork> DownloadFrontCoverAsync(Guid releaseId, string imageId, bool preview, CancellationToken cancellationToken);
}
