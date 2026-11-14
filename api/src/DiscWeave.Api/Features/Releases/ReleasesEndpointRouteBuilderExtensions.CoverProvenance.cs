using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.CoverArtwork;
using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static async Task<IResult> GetReleaseCoverProvenanceAsync(
        Guid releaseId, DiscWeaveDbContext context, ICurrentCollection currentCollection,
        IReleaseCoverStorage storage, CancellationToken cancellationToken)
    {
        Release? release = await context.Releases.AsNoTracking().SingleOrDefaultAsync(
            entity => entity.CollectionId == currentCollection.CollectionId && entity.Id == new ReleaseId(releaseId),
            cancellationToken);
        CoverImage? cover = release is null ? null : TryGetCoverImage(release);
        if (cover is null)
        {
            return EndpointErrors.NotFound("release_cover.not_found", "Release cover image was not found");
        }

        CoverArtworkProvenance? provenance = storage is IReleaseCoverProvenanceStorage provenanceStorage
            ? await provenanceStorage.ReadAsync(cover.StorageKey, cancellationToken)
            : null;
        return Results.Ok(new { Provenance = provenance });
    }
}
