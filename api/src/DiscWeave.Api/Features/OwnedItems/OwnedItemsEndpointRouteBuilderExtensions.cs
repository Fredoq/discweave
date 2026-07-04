using DiscWeave.Api.Auth;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Persistence;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.OwnedItems;

public static partial class OwnedItemsEndpointRouteBuilderExtensions
{
    public static IEndpointRouteBuilder MapOwnedItemsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        RouteGroupBuilder group = endpoints.MapGroup("/api/owned-items")
            .WithTags("Owned Items")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);
        _ = group.MapPost("/", CreateOwnedItemAsync).WithName("CreateOwnedItem");
        _ = group.MapGet("/{ownedItemId:guid}", GetOwnedItemAsync).WithName("GetOwnedItem");
        _ = group.MapGet("", ListOwnedItemsAsync).WithName("ListOwnedItems");
        _ = group.MapPut("/{ownedItemId:guid}", UpdateOwnedItemAsync).WithName("UpdateOwnedItem");
        _ = group.MapDelete("/{ownedItemId:guid}", DeleteOwnedItemAsync).WithName("DeleteOwnedItem");

        return endpoints;
    }

    private static async Task<IResult> CreateOwnedItemAsync(
        CreateOwnedItemRequest request,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request.Medium);
            _ = await DictionaryValidation.RequireActiveEntryAsync(
                context,
                currentCollection.CollectionId,
                DictionaryKind.MediaType,
                request.Medium.Type ?? string.Empty,
                "medium.type_invalid",
                "Medium type is invalid",
                cancellationToken);
            IMedium medium = OwnedItemMapper.CreateMedium(request.Medium);
            var item = OwnedItem.Create(
                currentCollection.CollectionId,
                OwnedItemId.New(),
                OwnedItemMapper.CreateReleaseId(request.ReleaseId),
                OwnedItemMapper.ParseOwnershipStatus(request.Status),
                medium);
            item.UpdateHolding(OwnedItemMapper.CreateHolding(item.Holding.Medium, request.Status, request.Condition, request.StorageLocation, request.Note));
            IRepository<OwnedItem, OwnedItemId> items = unitOfWork.GetRepository<OwnedItem, OwnedItemId>();
            items.Add(item);
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);

            OwnedItemResponse response = await OwnedItemResponseMapper.ToResponseAsync(
                context,
                currentCollection.CollectionId,
                item,
                cancellationToken);

            return Results.Created($"/api/owned-items/{item.Id}", response);
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (ArgumentException)
        {
            return EndpointErrors.BadRequest("owned_item.request_invalid", "Owned item request is invalid");
        }
        catch (ReferencedResourceMissingException)
        {
            return EndpointErrors.Conflict("owned_item.target_conflict", "Owned item target does not exist");
        }
    }

    private static async Task<IResult> GetOwnedItemAsync(
        Guid ownedItemId,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        OwnedItem? item = await context.OwnedItems.AsNoTracking().SingleOrDefaultAsync(
            entity => entity.CollectionId == currentCollection.CollectionId && entity.Id == new OwnedItemId(ownedItemId),
            cancellationToken);

        return item is null
            ? EndpointErrors.NotFound("owned_item.not_found", "Owned item was not found")
            : Results.Ok(await OwnedItemResponseMapper.ToResponseAsync(
                context,
                currentCollection.CollectionId,
                item,
                cancellationToken));
    }

    private static async Task<IResult> UpdateOwnedItemAsync(
        Guid ownedItemId,
        UpdateOwnedItemRequest request,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        IRepository<OwnedItem, OwnedItemId> items = unitOfWork.GetRepository<OwnedItem, OwnedItemId>();
        OwnedItem? item = await items.TryFindAsync(new OwnedItemId(ownedItemId), cancellationToken);
        if (item is null || item.CollectionId != currentCollection.CollectionId)
        {
            return EndpointErrors.NotFound("owned_item.not_found", "Owned item was not found");
        }

        try
        {
            if (request.ReleaseId is not null)
            {
                item.UpdateRelease(OwnedItemMapper.CreateReleaseId(request.ReleaseId));
            }

            IMedium medium = item.Holding.Medium;
            if (request.Medium is not null)
            {
                _ = await DictionaryValidation.RequireActiveEntryAsync(
                    context,
                    currentCollection.CollectionId,
                    DictionaryKind.MediaType,
                    request.Medium.Type ?? string.Empty,
                    "medium.type_invalid",
                    "Medium type is invalid",
                    cancellationToken);
                medium = OwnedItemMapper.CreateMedium(request.Medium);
            }

            if (item.Holding.Medium is DigitalFile && medium is not DigitalFile)
            {
                await DeleteDigitalTrackFileLinksAsync(
                    context,
                    currentCollection.CollectionId,
                    item.Id,
                    cancellationToken);
            }

            string note = request.Note ?? item.Holding.Details.Note;
            item.UpdateHolding(OwnedItemMapper.CreateHolding(medium, request.Status, request.Condition, request.StorageLocation, note));

            _ = await unitOfWork.SaveChangesAsync(cancellationToken);

            OwnedItemResponse response = await OwnedItemResponseMapper.ToResponseAsync(
                context,
                currentCollection.CollectionId,
                item,
                cancellationToken);

            return Results.Ok(response);
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (ArgumentException)
        {
            return EndpointErrors.BadRequest("owned_item.request_invalid", "Owned item request is invalid");
        }
        catch (ReferencedResourceMissingException)
        {
            return EndpointErrors.Conflict("owned_item.target_conflict", "Owned item target does not exist");
        }
    }

    private static async Task DeleteDigitalTrackFileLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        OwnedItemId ownedItemId,
        CancellationToken cancellationToken)
    {
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks
            .Where(link => link.CollectionId == collectionId && link.DigitalOwnedItemId == ownedItemId)
            .ToArrayAsync(cancellationToken);
        if (links.Length > 0)
        {
            context.DigitalTrackFileLinks.RemoveRange(links);
        }
    }

    private static async Task<IResult> DeleteOwnedItemAsync(
        Guid ownedItemId,
        HttpRequest request,
        IUnitOfWork unitOfWork,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!DeleteConfirmation.Matches(request, "owned-item", ownedItemId))
        {
            return EndpointErrors.DeleteConfirmationRequired();
        }

        IRepository<OwnedItem, OwnedItemId> items = unitOfWork.GetRepository<OwnedItem, OwnedItemId>();
        OwnedItem? item = await items.TryFindAsync(new OwnedItemId(ownedItemId), cancellationToken);
        if (item is null || item.CollectionId != currentCollection.CollectionId)
        {
            return EndpointErrors.NotFound("owned_item.not_found", "Owned item was not found");
        }

        try
        {
            items.Delete(item);
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);

            return Results.NoContent();
        }
        catch (ResourceHasDependentsException)
        {
            return EndpointErrors.Conflict("owned_item.delete_conflict", "Owned item has dependent data");
        }
    }
}
