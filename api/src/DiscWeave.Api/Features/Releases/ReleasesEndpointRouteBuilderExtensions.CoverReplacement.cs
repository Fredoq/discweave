using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static async Task ReplaceCoverAsync(
        Release release, ReleaseCoverReplacement replacement, DiscWeaveDbContext context,
        IReleaseCoverStorage storage, CancellationToken cancellationToken)
    {
        CoverImage? previous = TryGetCoverImage(release);
        ReleaseCoverStoredFile stored = await storage.SaveAsync(
            release.CollectionId, release.Id, replacement.Extension, replacement.Content, cancellationToken);
        try
        {
            if (replacement.Provenance is { } provenance)
            {
                if (storage is not IReleaseCoverProvenanceStorage provenanceStorage)
                {
                    throw new InvalidOperationException("Release cover storage does not support provenance");
                }
                await provenanceStorage.SaveAsync(stored.StorageKey, provenance, cancellationToken);
            }

            var cover = CoverImage.FromStoredMetadata(stored.StorageKey, replacement.ContentType,
                replacement.FileName, replacement.Content.Length,
                replacement.Provenance?.Provider ?? CoverImage.LocalUploadSourceType);
            release.UpdateSummary(release.Summary.WithMetadata(release.Summary.Metadata.WithCoverImage(cover)));
            _ = await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Only an uncommitted replacement may be rolled back. Cleanup must survive request cancellation.
            await DeleteObsoleteCoverAsync(storage, stored.StorageKey);
            throw;
        }

        // Cleanup failure after commit must never remove the newly referenced cover.
        if (previous is not null)
        {
            await DeleteObsoleteCoverAsync(storage, previous.StorageKey);
        }
    }

    private static async Task DeleteObsoleteCoverAsync(IReleaseCoverStorage storage, string storageKey)
    {
        try
        {
            await storage.DeleteAsync(storageKey, CancellationToken.None);
        }
        catch (IOException)
        {
            // The owned orphan is safer than deleting the current image or reporting a false rollback.
        }
        catch (UnauthorizedAccessException)
        {
            // A later storage maintenance operation can remove this unreferenced file.
        }
    }
}
