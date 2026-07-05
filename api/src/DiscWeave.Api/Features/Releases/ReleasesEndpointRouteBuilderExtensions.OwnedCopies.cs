using DiscWeave.Api.Features.OwnedItems;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private const string OwnedItemReleaseIdProperty = "_releaseId";

    private static async Task CreateOwnedCopiesAsync(
        ReleaseRequest request,
        Release release,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        foreach (ReleaseOwnedCopyRequest ownedCopy in ReleaseOwnedCopyRequests(request))
        {
            IMedium medium = await ResolveOwnedCopyMediumAsync(ownedCopy, context, collectionId, cancellationToken);
            OwnedItem item = CreateOwnedItem(collectionId, release.Id, ownedCopy, medium);
            _ = context.OwnedItems.Add(item);
        }
    }

    private static async Task SyncOwnedCopiesAsync(
        ReleaseRequest request,
        Release release,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (request.OwnedCopies is null && request.OwnedCopy is null)
        {
            return;
        }

        OwnedItem[] existingItems = await context.OwnedItems
            .Where(item =>
                item.CollectionId == collectionId &&
                EF.Property<ReleaseId>(item, OwnedItemReleaseIdProperty) == release.Id)
            .ToArrayAsync(cancellationToken);
        Dictionary<OwnedItemId, OwnedItem> existingItemsById = existingItems.ToDictionary(item => item.Id);

        foreach (ReleaseOwnedCopyRequest ownedCopy in ReleaseOwnedCopyRequests(request))
        {
            IMedium medium = await ResolveOwnedCopyMediumAsync(ownedCopy, context, collectionId, cancellationToken);
            if (ownedCopy.Id is { } id && id != Guid.Empty)
            {
                var ownedItemId = new OwnedItemId(id);
                if (!existingItemsById.TryGetValue(ownedItemId, out OwnedItem? item))
                {
                    throw new DomainException("owned_item.not_found", "Owned item does not belong to this release");
                }

                await UpdateOwnedItemFromReleaseAsync(item, ownedCopy, medium, context, collectionId, cancellationToken);
                continue;
            }

            OwnedItem created = CreateOwnedItem(collectionId, release.Id, ownedCopy, medium);
            _ = context.OwnedItems.Add(created);
        }
    }

    private static async Task<IMedium> ResolveOwnedCopyMediumAsync(
        ReleaseOwnedCopyRequest ownedCopy,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        _ = await DictionaryValidation.RequireActiveEntryAsync(
            context,
            collectionId,
            DictionaryKind.MediaType,
            ownedCopy.Medium.Type ?? string.Empty,
            "medium.type_invalid",
            "Medium type is invalid",
            cancellationToken);

        return OwnedItemMapper.CreateMedium(ownedCopy.Medium);
    }

    private static OwnedItem CreateOwnedItem(
        CollectionId collectionId,
        ReleaseId releaseId,
        ReleaseOwnedCopyRequest ownedCopy,
        IMedium medium)
    {
        var item = OwnedItem.Create(
            collectionId,
            OwnedItemId.New(),
            releaseId,
            OwnedItemMapper.ParseOwnershipStatus(ownedCopy.Status),
            medium);
        item.UpdateHolding(OwnedItemMapper.CreateHolding(item.Holding.Medium, ownedCopy.Status, ownedCopy.Condition, ownedCopy.StorageLocation, ownedCopy.Note));

        return item;
    }

    private static async Task UpdateOwnedItemFromReleaseAsync(
        OwnedItem item,
        ReleaseOwnedCopyRequest ownedCopy,
        IMedium medium,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        if (item.Holding.Medium is DigitalFile && medium is not DigitalFile)
        {
            DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks
                .Where(link => link.CollectionId == collectionId && link.DigitalOwnedItemId == item.Id)
                .ToArrayAsync(cancellationToken);
            if (links.Length > 0)
            {
                context.DigitalTrackFileLinks.RemoveRange(links);
            }
        }

        string? condition = ownedCopy.Condition ?? OwnedItemMapper.ToItemConditionCodeOrNull(item);
        string? storageLocation = ownedCopy.StorageLocation ?? OwnedItemMapper.ToStorageLocationOrNull(item);
        if (medium is DigitalFile)
        {
            condition = null;
            storageLocation = null;
        }

        string note = ownedCopy.Note ?? item.Holding.Details.Note;
        item.UpdateHolding(OwnedItemMapper.CreateHolding(medium, ownedCopy.Status, condition, storageLocation, note));
    }

    private static IReadOnlyList<ReleaseOwnedCopyRequest> ReleaseOwnedCopyRequests(ReleaseRequest request)
    {
        return request.OwnedCopies ?? SingleOwnedCopyRequest(request.OwnedCopy);
    }

    private static IReadOnlyList<ReleaseOwnedCopyRequest> SingleOwnedCopyRequest(ReleaseOwnedCopyRequest? ownedCopy)
    {
        return ownedCopy is null ? [] : [ownedCopy];
    }
}
