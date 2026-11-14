using System.Security.Cryptography;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> SearchExternalCoverArtworkAsync(
        Guid sessionId, Guid draftId, [AsParameters] ImportCoverSearchRequest search,
        [AsParameters] ImportCoverEndpointServices services, CancellationToken cancellationToken)
    {
        DiscWeaveDbContext context = services.Context;
        ICurrentCollection currentCollection = services.CurrentCollection;
        IExternalCoverArtworkProvider provider = services.Provider;
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        if (draft is null)
        {
            return ReleaseImportDraftNotFound();
        }

        try
        {
            return Results.Ok(new { Items = await provider.SearchReleasesAsync(new CoverReleaseSearchQuery(search.Artist ?? string.Empty, search.Title ?? string.Empty, search.CatalogNumber, search.Barcode), cancellationToken) });
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> GetExternalCoverArtworkAsync(
        Guid sessionId, Guid draftId, Guid releaseId, DiscWeaveDbContext context,
        ICurrentCollection currentCollection, IExternalCoverArtworkProvider provider, CancellationToken cancellationToken)
    {
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        if (draft is null)
        {
            return ReleaseImportDraftNotFound();
        }

        try
        {
            return Results.Ok(new { Items = await provider.GetFrontCoversAsync(releaseId, cancellationToken) });
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> PreviewExternalCoverArtworkAsync(
        Guid sessionId, Guid draftId, Guid releaseId, string imageId,
        [AsParameters] ImportCoverEndpointServices services, HttpResponse response, CancellationToken cancellationToken)
    {
        DiscWeaveDbContext context = services.Context;
        ICurrentCollection currentCollection = services.CurrentCollection;
        IExternalCoverArtworkProvider provider = services.Provider;
        response.Headers.CacheControl = "no-store";
        response.Headers.XContentTypeOptions = "nosniff";
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        if (draft is null)
        {
            return ReleaseImportDraftNotFound();
        }

        try
        {
            DownloadedCoverArtwork artwork = await provider.DownloadFrontCoverAsync(releaseId, imageId, true, cancellationToken);
            _ = ImportCoverValidation.Validate(artwork.FileName, artwork.ContentType, artwork.Content);
            return Results.File(artwork.Content, artwork.ContentType);
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> SelectExternalCoverArtworkAsync(
        Guid sessionId, Guid draftId, ImportExternalCoverSelectionRequest request,
        [AsParameters] ImportCoverEndpointServices services, CancellationToken cancellationToken)
    {
        DiscWeaveDbContext context = services.Context;
        ICurrentCollection currentCollection = services.CurrentCollection;
        IExternalCoverArtworkProvider provider = services.Provider;
        ImportCoverArtifactStore store = services.Store;
        await using IAsyncDisposable mutationLock = await ReleaseImportConfirmationService.AcquireDraftMutationLockAsync(
            currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        ReleaseImportDraft? draft = await FindDraftAsync(context, currentCollection.CollectionId, sessionId, draftId, cancellationToken);
        if (draft is null)
        {
            return ReleaseImportDraftNotFound();
        }

        try
        {
            if (!CanEditCover(draft))
            {
                throw new DomainException("release_import.draft_not_editable", "Import cover cannot be changed in this draft");
            }

            DownloadedCoverArtwork artwork = await provider.DownloadFrontCoverAsync(request.ReleaseId, request.ImageId, false, cancellationToken);
            string extension = ImportCoverValidation.Validate(artwork.FileName, artwork.ContentType, artwork.Content);
            string hash = Convert.ToHexString(SHA256.HashData(artwork.Content));
            CoverArtworkProvenance provenance = artwork.Provenance with { Sha256 = hash };
            byte[]? previousProvenance = await store.ReadProvenanceBytesAsync(draft, hash, cancellationToken);
            try
            {
                await store.SaveProvenanceAsync(draft, provenance, cancellationToken);
                draft.SelectLocalCover(new ReleaseImportCoverArtifact(artwork.FileName, extension, artwork.ContentType, artwork.Content.LongLength, artwork.Content), ToOptional(null));
                _ = await context.SaveChangesAsync(cancellationToken);
            }
            catch
            {
                await store.WriteProvenanceAsync(draft, hash, previousProvenance, CancellationToken.None);
                throw;
            }

            return Results.Ok(await CoverArtworkResponseAsync(draft, store, cancellationToken));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (HttpRequestException)
        {
            return EndpointErrors.BadRequest("cover_artwork.unavailable", "Artwork provider is unavailable");
        }
    }
}
