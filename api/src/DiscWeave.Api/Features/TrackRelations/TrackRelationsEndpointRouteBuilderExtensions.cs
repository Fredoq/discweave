using DiscWeave.Api.Auth;
using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Persistence;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.TrackRelations;

public static partial class TrackRelationsEndpointRouteBuilderExtensions
{
    private const string TrackRelationNotFoundCode = "track_relation.not_found";
    private const string TrackRelationNotFoundMessage = "Track relation was not found";
    private const string TrackRelationDuplicateCode = "track_relation.duplicate";
    private const string TrackRelationDuplicateMessage = "Track relation already exists";
    private const string TrackRelationTrackConflictCode = "track_relation.track_conflict";
    private const string TrackRelationTrackConflictMessage = "Track relation references a missing track";
    private const string TrackRelationTypeInvalidCode = "track_relation.type_invalid";
    private const string TrackRelationTypeInvalidMessage = "Track relation type is invalid";

    public static IEndpointRouteBuilder MapTrackRelationsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        RouteGroupBuilder group = endpoints.MapGroup("/api/track-relations")
            .WithTags("Track Relations")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);
        _ = group.MapPost("/", CreateTrackRelationAsync).WithName("CreateTrackRelation");
        _ = group.MapPost("/stack", CreateStackTrackRelationAsync).WithName("CreateStackTrackRelation");
        _ = group.MapGet("/{relationId:guid}", GetTrackRelationAsync).WithName("GetTrackRelation");
        _ = group.MapGet("", ListTrackRelationsAsync).WithName("ListTrackRelations");
        _ = group.MapPut("/{relationId:guid}", UpdateTrackRelationAsync).WithName("UpdateTrackRelation");
        _ = group.MapDelete("/{relationId:guid}", DeleteTrackRelationAsync).WithName("DeleteTrackRelation");

        return endpoints;
    }

    private static async Task<IResult> CreateTrackRelationAsync(
        TrackRelationRequest request,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        try
        {
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
            if (await TrackRelationExistsAsync(context, currentCollection.CollectionId, identityKey, null, cancellationToken))
            {
                return EndpointErrors.Conflict(TrackRelationDuplicateCode, TrackRelationDuplicateMessage);
            }

            var relation = TrackRelation.Create(TrackRelationId.New(), currentCollection.CollectionId, new TrackId(request.SourceTrackId), new TrackId(request.TargetTrackId), relationType);
            unitOfWork.GetRepository<TrackRelation, TrackRelationId>().Add(relation);
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);

            return Results.Created(
                $"/api/track-relations/{relation.Id.Value}",
                await ToResponseAsync(relation, context, cancellationToken));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

    private static async Task<IResult> CreateStackTrackRelationAsync(
        StackTrackRelationRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        await using Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction transaction =
            await context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
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
            IReadOnlyList<string> stackRelationTypeCodes = await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                context,
                currentCollection.CollectionId,
                cancellationToken);
            if (!stackRelationTypeCodes.Contains(relationType, StringComparer.Ordinal))
            {
                return EndpointErrors.BadRequest(
                    "track_relation.stack_type_invalid",
                    "Track relation type is not configured for track stacks");
            }

            string identityKey = TrackRelationIdentity.From(
                new TrackId(request.SourceTrackId),
                new TrackId(request.TargetTrackId),
                relationType).Value;
            if (await TrackRelationExistsAsync(context, currentCollection.CollectionId, identityKey, null, cancellationToken))
            {
                return EndpointErrors.Conflict(TrackRelationDuplicateCode, TrackRelationDuplicateMessage);
            }

            var relation = TrackRelation.Create(TrackRelationId.New(), currentCollection.CollectionId, new TrackId(request.SourceTrackId), new TrackId(request.TargetTrackId), relationType);
            _ = context.TrackRelations.Add(relation);

            if (request.MarkTargetAsOriginal)
            {
                Track? targetTrack = await context.Tracks.SingleOrDefaultAsync(
                    track => track.CollectionId == currentCollection.CollectionId && track.Id == new TrackId(request.TargetTrackId),
                    cancellationToken);
                if (targetTrack is null)
                {
                    return EndpointErrors.Conflict(TrackRelationTrackConflictCode, TrackRelationTrackConflictMessage);
                }

                targetTrack.UpdateMetadata(targetTrack.Metadata.WithOriginalMarker(true));
            }

            _ = await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return Results.Created(
                $"/api/track-relations/{relation.Id.Value}",
                await ToResponseAsync(relation, context, cancellationToken));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
        catch (ResourceConflictException)
        {
            return EndpointErrors.Conflict(TrackRelationDuplicateCode, TrackRelationDuplicateMessage);
        }
    }

    private static async Task<IResult> GetTrackRelationAsync(
        Guid relationId,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        TrackRelation? relation = await context.TrackRelations.AsNoTracking().SingleOrDefaultAsync(
            entity => entity.CollectionId == currentCollection.CollectionId && entity.Id == new TrackRelationId(relationId),
            cancellationToken);

        return relation is null
            ? EndpointErrors.NotFound(TrackRelationNotFoundCode, TrackRelationNotFoundMessage)
            : Results.Ok(await ToResponseAsync(relation, context, cancellationToken));
    }

    private static async Task<IResult> ListTrackRelationsAsync(
        [AsParameters] TrackRelationListRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!Pagination.TryNormalize(request.Limit, request.Offset, out int normalizedLimit, out int normalizedOffset, out IResult error))
        {
            return error;
        }

        try
        {
            string? relationType = string.IsNullOrWhiteSpace(request.Type)
                ? null
                : await DictionaryValidation.RequireCodeAsync(
                    context,
                    currentCollection.CollectionId,
                    DictionaryKind.TrackRelationType,
                    TrackRelationMapper.ParseType(request.Type),
                    TrackRelationTypeInvalidCode,
                    TrackRelationTypeInvalidMessage,
                    cancellationToken);
            IQueryable<TrackRelation> relations = ApplyFilters(
                context.TrackRelations.AsNoTracking().Where(relation => relation.CollectionId == currentCollection.CollectionId),
                request.SourceTrackId,
                request.TargetTrackId,
                relationType);
            int total = await relations.CountAsync(cancellationToken);
            TrackRelation[] page = await relations.OrderBy(relation => relation.Id).Skip(normalizedOffset).Take(normalizedLimit).ToArrayAsync(cancellationToken);

            return Results.Ok(new ListResponse<TrackRelationResponse>(
                await ToResponsesAsync(page, context, cancellationToken),
                normalizedLimit,
                normalizedOffset,
                total));
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(exception.Code, exception.Message);
        }
    }

}
