using System.Security.Cryptography;
using DiscWeave.Api.Features.Imports;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static async Task<IResult> SearchReleaseCoverArtworkAsync(
        Guid releaseId, [AsParameters] ReleaseCoverSearchRequest search,
        [AsParameters] ReleaseCoverEndpointServices services, CancellationToken cancellationToken)
    {
        if (await FindCoverReleaseAsync(releaseId, services, cancellationToken) is null)
        {
            return EndpointErrors.NotFound("release.not_found", "Release was not found");
        }
        try
        {
            return Results.Ok(new
            {
                Items = await services.Provider.SearchReleasesAsync(
                new CoverReleaseSearchQuery(search.Artist ?? string.Empty, search.Title ?? string.Empty,
                    search.CatalogNumber, search.Barcode), cancellationToken)
            });
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> GetReleaseCoverArtworkAsync(
        Guid releaseId, Guid externalReleaseId, [AsParameters] ReleaseCoverEndpointServices services,
        CancellationToken cancellationToken)
    {
        if (await FindCoverReleaseAsync(releaseId, services, cancellationToken) is null)
        {
            return EndpointErrors.NotFound("release.not_found", "Release was not found");
        }
        try
        {
            return Results.Ok(new { Items = await services.Provider.GetFrontCoversAsync(externalReleaseId, cancellationToken) });
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> PreviewReleaseCoverArtworkAsync(
        Guid releaseId, Guid externalReleaseId, string imageId,
        [AsParameters] ReleaseCoverEndpointServices services, HttpResponse response, CancellationToken cancellationToken)
    {
        response.Headers.CacheControl = "no-store";
        response.Headers.XContentTypeOptions = "nosniff";
        if (await FindCoverReleaseAsync(releaseId, services, cancellationToken) is null)
        {
            return EndpointErrors.NotFound("release.not_found", "Release was not found");
        }
        try
        {
            DownloadedCoverArtwork artwork = await services.Provider.DownloadFrontCoverAsync(externalReleaseId, imageId, true, cancellationToken);
            _ = ImportCoverValidation.Validate(artwork.FileName, artwork.ContentType, artwork.Content);
            return Results.File(artwork.Content, artwork.ContentType);
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> SelectReleaseCoverArtworkAsync(
        Guid releaseId, ReleaseExternalCoverSelectionRequest request,
        [AsParameters] ReleaseCoverEndpointServices services, CancellationToken cancellationToken)
    {
        await using IAsyncDisposable mutationLock = await ReleaseMutationLock.AcquireAsync(
            services.CurrentCollection.CollectionId, releaseId, cancellationToken);
        Release? release = await FindCoverReleaseAsync(releaseId, services, cancellationToken);
        if (release is null)
        {
            return EndpointErrors.NotFound("release.not_found", "Release was not found");
        }
        try
        {
            DownloadedCoverArtwork artwork = await services.Provider.DownloadFrontCoverAsync(request.ReleaseId, request.ImageId, false, cancellationToken);
            string extension = ImportCoverValidation.Validate(artwork.FileName, artwork.ContentType, artwork.Content);
            using var content = new MemoryStream(artwork.Content, writable: false);
            await ReplaceCoverAsync(release, new ReleaseCoverReplacement
            {
                Content = content,
                Extension = extension,
                ContentType = artwork.ContentType,
                FileName = artwork.FileName,
                Provenance = artwork.Provenance with { Sha256 = Convert.ToHexString(SHA256.HashData(artwork.Content)) }
            }, services.Context, services.Storage, cancellationToken);
            return Results.Ok(ToCoverImageResponse(release));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static Task<Release?> FindCoverReleaseAsync(
        Guid releaseId, ReleaseCoverEndpointServices services, CancellationToken cancellationToken)
    {
        return services.Context.Releases.SingleOrDefaultAsync(
            entity => entity.CollectionId == services.CurrentCollection.CollectionId && entity.Id == new ReleaseId(releaseId),
            cancellationToken);
    }
}
