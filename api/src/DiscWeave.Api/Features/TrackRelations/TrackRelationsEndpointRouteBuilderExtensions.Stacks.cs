using DiscWeave.Api.Http;
using DiscWeave.Application.Errors;
using DiscWeave.Application.Persistence;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace DiscWeave.Api.Features.TrackRelations;

public static partial class TrackRelationsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> CreateStackTrackRelationAsync(
        StackTrackRelationRequest request,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        TrackStackAssignmentService assignmentService,
        CancellationToken cancellationToken)
    {
        if (request.SourceTrackId == request.TargetTrackId)
        {
            return EndpointErrors.BadRequest(
                "track_relation.stack_self_relation",
                "Track relation cannot reference the same track twice");
        }

        await using IDbContextTransaction transaction =
            await context.Database.BeginTransactionAsync(cancellationToken);

        try
        {
            TrackId sourceId = new(request.SourceTrackId);
            TrackId targetId = new(request.TargetTrackId);
            Track? source = await context.Tracks.SingleOrDefaultAsync(
                track => track.CollectionId == currentCollection.CollectionId &&
                    track.Id == sourceId,
                cancellationToken);
            Track? target = await context.Tracks.SingleOrDefaultAsync(
                track => track.CollectionId == currentCollection.CollectionId &&
                    track.Id == targetId,
                cancellationToken);
            if (source is null || target is null)
            {
                return EndpointErrors.NotFound(
                    TrackRelationTrackConflictCode,
                    TrackRelationTrackConflictMessage);
            }

            string requestedType = TrackRelationMapper.ParseType(request.Type);
            TrackStackAssignmentResult assignment =
                await assignmentService.AssignAsync(
                    context,
                    currentCollection.CollectionId,
                    source,
                    target,
                    requestedType,
                    request.MarkTargetAsOriginal,
                    cancellationToken);
            if (!assignment.IsSuccess)
            {
                return MapStackAssignmentFailure(assignment.Failure);
            }

            TrackRelation relation = assignment.Relation ??
                throw new InvalidOperationException(
                    "A successful stack assignment must return a relation");
            _ = await unitOfWork.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            TrackRelationResponse response = await ToResponseAsync(
                relation,
                context,
                cancellationToken);
            return assignment.WasCreated
                ? Results.Created(
                    $"/api/track-relations/{relation.Id.Value}",
                    response)
                : Results.Ok(response);
        }
        catch (DomainException exception)
        {
            return EndpointErrors.BadRequest(
                exception.Code,
                exception.Message);
        }
        catch (ResourceConflictException)
        {
            return StackRelationIdentityConflict();
        }
    }
}
