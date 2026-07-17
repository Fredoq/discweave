using DiscWeave.Api.Features.Settings;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.TrackStacks;
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
using Microsoft.EntityFrameworkCore.Storage;

namespace DiscWeave.Api.Features.TrackRelations;

public static partial class TrackRelationsEndpointRouteBuilderExtensions
{
    private static async Task<IResult> CreateStackTrackRelationAsync(
        StackTrackRelationRequest request,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        TrackStackRelationValidator validator,
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
            string identityKey = TrackRelationIdentity.From(
                source.Id,
                target.Id,
                requestedType).Value;
            TrackRelation? existing = await FindTrackRelationByIdentityAsync(
                context,
                currentCollection.CollectionId,
                identityKey,
                cancellationToken);
            return existing is not null
                ? await CompleteExistingStackRelationAsync(
                    request,
                    existing,
                    target,
                    unitOfWork,
                    context,
                    currentCollection,
                    transaction,
                    cancellationToken)
                : await CreateNewStackRelationAsync(
                    request,
                    requestedType,
                    source,
                    target,
                    unitOfWork,
                    context,
                    currentCollection,
                    validator,
                    transaction,
                    cancellationToken);
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

    private static async Task<IResult> CompleteExistingStackRelationAsync(
        StackTrackRelationRequest request,
        TrackRelation existing,
        Track target,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        IDbContextTransaction transaction,
        CancellationToken cancellationToken)
    {
        if (request.MarkTargetAsOriginal && !target.Metadata.IsOriginal)
        {
            IReadOnlyList<string> configuredTypes =
                await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                    context,
                    currentCollection.CollectionId,
                    cancellationToken);
            bool targetHasAnotherStackRelation =
                configuredTypes.Count > 0 &&
                await context.TrackRelations.AsNoTracking().AnyAsync(
                    relation =>
                        relation.CollectionId == currentCollection.CollectionId &&
                        relation.Id != existing.Id &&
                        configuredTypes.Contains(relation.RelationType) &&
                        (relation.SourceTrackId == target.Id ||
                            relation.TargetTrackId == target.Id),
                    cancellationToken);
            if (targetHasAnotherStackRelation)
            {
                return MapStackValidationFailure(
                    TrackStackRelationValidationFailure.TargetNotStandalone);
            }

            target.UpdateMetadata(target.Metadata.WithOriginalMarker(true));
        }

        _ = await unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.Ok(
            await ToResponseAsync(existing, context, cancellationToken));
    }

    private static async Task<IResult> CreateNewStackRelationAsync(
        StackTrackRelationRequest request,
        string requestedType,
        Track source,
        Track target,
        IUnitOfWork unitOfWork,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        TrackStackRelationValidator validator,
        IDbContextTransaction transaction,
        CancellationToken cancellationToken)
    {
        string relationType = await DictionaryValidation.RequireActiveCodeAsync(
            context,
            currentCollection.CollectionId,
            DictionaryKind.TrackRelationType,
            requestedType,
            TrackRelationTypeInvalidCode,
            TrackRelationTypeInvalidMessage,
            cancellationToken);
        IReadOnlyList<string> configuredTypeCodes =
            await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                context,
                currentCollection.CollectionId,
                cancellationToken);
        TrackStackGraph graph = await LoadTrackStackGraphAsync(
            context,
            currentCollection,
            configuredTypeCodes,
            cancellationToken);
        TrackStackRelationValidationFailure failure = validator.ValidateNew(
            source,
            target,
            relationType,
            configuredTypeCodes,
            graph,
            request.MarkTargetAsOriginal);
        if (failure != TrackStackRelationValidationFailure.None)
        {
            return MapStackValidationFailure(failure);
        }

        var relation = TrackRelation.Create(
            TrackRelationId.New(),
            currentCollection.CollectionId,
            source.Id,
            target.Id,
            relationType);
        _ = context.TrackRelations.Add(relation);
        if (request.MarkTargetAsOriginal)
        {
            target.UpdateMetadata(target.Metadata.WithOriginalMarker(true));
        }

        _ = await unitOfWork.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        TrackRelationResponse response = await ToResponseAsync(
            relation,
            context,
            cancellationToken);
        return Results.Created(
            $"/api/track-relations/{relation.Id.Value}",
            response);
    }

    private static async Task<TrackStackGraph> LoadTrackStackGraphAsync(
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        IReadOnlyCollection<string> configuredTypeCodes,
        CancellationToken cancellationToken)
    {
        Track[] tracks = await context.Tracks.AsNoTracking()
            .Where(track =>
                track.CollectionId == currentCollection.CollectionId)
            .ToArrayAsync(cancellationToken);
        TrackRelation[] relations = configuredTypeCodes.Count == 0
            ? []
            : await context.TrackRelations.AsNoTracking()
                .Where(relation =>
                    relation.CollectionId == currentCollection.CollectionId &&
                    configuredTypeCodes.Contains(relation.RelationType))
                .ToArrayAsync(cancellationToken);
        return new TrackStackGraph(tracks, relations);
    }
}
