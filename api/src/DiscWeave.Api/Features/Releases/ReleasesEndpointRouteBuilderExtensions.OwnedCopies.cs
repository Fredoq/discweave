using DiscWeave.Api.Features.OwnedItems;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static async Task CreateOwnedCopiesAsync(
        ReleaseRequest request,
        Release release,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        foreach (ReleaseOwnedCopyRequest ownedCopy in ReleaseOwnedCopyRequests(request))
        {
            _ = await DictionaryValidation.RequireActiveEntryAsync(
                context,
                collectionId,
                DictionaryKind.MediaType,
                ownedCopy.Medium.Type ?? string.Empty,
                "medium.type_invalid",
                "Medium type is invalid",
                cancellationToken);
            IMedium medium = OwnedItemMapper.CreateMedium(ownedCopy.Medium);
            var item = OwnedItem.Create(
                collectionId,
                OwnedItemId.New(),
                release.Id,
                OwnedItemMapper.ParseOwnershipStatus(ownedCopy.Status),
                medium);
            item.UpdateHolding(OwnedItemMapper.CreateHolding(item.Holding.Medium, ownedCopy.Status, ownedCopy.Condition, ownedCopy.StorageLocation));
            _ = context.OwnedItems.Add(item);
        }
    }

    private static IReadOnlyList<ReleaseOwnedCopyRequest> ReleaseOwnedCopyRequests(ReleaseRequest request) =>
        request.OwnedCopies is { Count: > 0 }
            ? request.OwnedCopies
            : request.OwnedCopy is { } ownedCopy ? [ownedCopy] : [];
}
