using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.OwnedItems;

public static partial class OwnedItemsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> UpdateDigitalFileAsync(
        Guid ownedItemId,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        OwnedItem? item = await context.OwnedItems.SingleOrDefaultAsync(
            entity => entity.CollectionId == currentCollection.CollectionId && entity.Id == new OwnedItemId(ownedItemId),
            cancellationToken);
        return item switch
        {
            null => EndpointErrors.NotFound("owned_item.not_found", "Owned item was not found"),
            { Holding.Medium: not DigitalFile } => EndpointErrors.BadRequest("owned_item.digital_file_required", "Owned item must reference a digital file"),
            _ => EndpointErrors.BadRequest(
                "owned_item.digital_file_links_required",
                "Digital file metadata is managed through local audio file links")
        };
    }
}
