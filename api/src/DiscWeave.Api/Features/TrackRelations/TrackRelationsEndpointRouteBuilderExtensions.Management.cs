using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Persistence;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.TrackRelations;

public static partial class TrackRelationsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> UpdateTrackRelationAsync(
        Guid relationId,
        TrackRelationRequest request,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        IRepository<TrackRelation, TrackRelationId> relations = unitOfWork.GetRepository<TrackRelation, TrackRelationId>();
        TrackRelation? relation = await relations.TryFindAsync(new TrackRelationId(relationId), cancellationToken);
        if (relation is null)
        {
            return EndpointErrors.NotFound(TrackRelationNotFoundCode, TrackRelationNotFoundMessage);
        }

        try
        {
            if (relation.CollectionId != currentCollection.CollectionId)
            {
                return EndpointErrors.NotFound(TrackRelationNotFoundCode, TrackRelationNotFoundMessage);
            }

            if (!await TracksExistAsync(request.SourceTrackId, request.TargetTrackId, context, currentCollection.CollectionId, cancellationToken))
            {
                return EndpointErrors.Conflict(TrackRelationTrackConflictCode, TrackRelationTrackConflictMessage);
            }

            string relationType = await DictionaryValidation.RequireActiveCodeAsync(
                context,
                currentCollection.CollectionId,
                DictionaryKind.TrackRelationType,
                TrackRelationMapper.ParseType(request.Type),
                TrackRelationTypeInvalidCode,
                TrackRelationTypeInvalidMessage,
                cancellationToken);
            string identityKey = TrackRelationIdentity.From(
                new TrackId(request.SourceTrackId),
                new TrackId(request.TargetTrackId),
                relationType).Value;
            if (await TrackRelationExistsAsync(context, currentCollection.CollectionId, identityKey, relation.Id, cancellationToken))
            {
                return EndpointErrors.Conflict(TrackRelationDuplicateCode, TrackRelationDuplicateMessage);
            }

            relation.Update(new TrackId(request.SourceTrackId), new TrackId(request.TargetTrackId), relationType);
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);

            return Results.Ok(await ToResponseAsync(relation, context, cancellationToken));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> DeleteTrackRelationAsync(
        Guid relationId,
        HttpRequest request,
        IUnitOfWork unitOfWork,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!DeleteConfirmation.Matches(request, "track-relation", relationId))
        {
            return EndpointErrors.DeleteConfirmationRequired();
        }

        IRepository<TrackRelation, TrackRelationId> relations = unitOfWork.GetRepository<TrackRelation, TrackRelationId>();
        TrackRelation? relation = await relations.TryFindAsync(new TrackRelationId(relationId), cancellationToken);
        if (relation is null || relation.CollectionId != currentCollection.CollectionId)
        {
            return EndpointErrors.NotFound(TrackRelationNotFoundCode, TrackRelationNotFoundMessage);
        }

        try
        {
            relations.Delete(relation);
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        }
        catch (ResourceHasDependentsException)
        {
            return EndpointErrors.Conflict("track_relation.delete_conflict", "Track relation has dependent data");
        }
    }

    private static IQueryable<TrackRelation> ApplyFilters(IQueryable<TrackRelation> relations, Guid? sourceTrackId, Guid? targetTrackId, string? type)
    {
        if (sourceTrackId is { } sourceId)
        {
            relations = relations.Where(relation => relation.SourceTrackId == new TrackId(sourceId));
        }

        if (targetTrackId is { } targetId)
        {
            relations = relations.Where(relation => relation.TargetTrackId == new TrackId(targetId));
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            relations = relations.Where(relation => relation.RelationType == type);
        }

        return relations;
    }

    private static async Task<bool> TrackRelationExistsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string identityKey,
        TrackRelationId? excludedRelationId,
        CancellationToken cancellationToken)
    {
        IQueryable<TrackRelation> query = context.TrackRelations
            .AsNoTracking()
            .Where(relation => relation.CollectionId == collectionId && EF.Property<string>(relation, "_identityKey") == identityKey);

        if (excludedRelationId is { } relationId)
        {
            query = query.Where(relation => relation.Id != relationId);
        }

        return await query.AnyAsync(cancellationToken);
    }

    private static async Task<TrackRelation?> FindTrackRelationByIdentityAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string identityKey,
        CancellationToken cancellationToken)
    {
        return await context.TrackRelations.SingleOrDefaultAsync(
            relation => relation.CollectionId == collectionId && EF.Property<string>(relation, "_identityKey") == identityKey,
            cancellationToken);
    }

    private static async Task<bool> TracksExistAsync(
        Guid sourceTrackId,
        Guid targetTrackId,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        TrackId sourceId = new(sourceTrackId);
        TrackId targetId = new(targetTrackId);

        return sourceTrackId == targetTrackId
            ? await context.Tracks.AnyAsync(track => track.CollectionId == collectionId && track.Id == sourceId, cancellationToken)
            : await context.Tracks.CountAsync(track => track.CollectionId == collectionId && (track.Id == sourceId || track.Id == targetId), cancellationToken) == 2;
    }
}

internal sealed record StackTrackRelationRequest(
    Guid SourceTrackId,
    Guid TargetTrackId,
    string Type,
    bool MarkTargetAsOriginal);
