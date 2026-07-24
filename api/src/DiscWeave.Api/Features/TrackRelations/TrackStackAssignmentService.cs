using DiscWeave.Api.Features.Settings;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace DiscWeave.Api.Features.TrackRelations;

public sealed class TrackStackAssignmentService
{
    private const string TrackRelationTypeInvalidCode =
        "track_relation.type_invalid";
    private const string TrackRelationTypeInvalidMessage =
        "Track relation type is invalid";

    private readonly TrackStackRelationValidator _validator;

    public TrackStackAssignmentService(
        TrackStackRelationValidator validator)
    {
        ArgumentNullException.ThrowIfNull(validator);

        _validator = validator;
    }

    public Task<TrackStackAssignmentResult> ValidateAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track source,
        Track target,
        string relationTypeCode,
        bool markTargetAsOriginal,
        CancellationToken cancellationToken)
    {
        return EvaluateAsync(
            context,
            collectionId,
            source,
            target,
            relationTypeCode,
            markTargetAsOriginal,
            assign: false,
            cancellationToken);
    }

    public Task<TrackStackAssignmentResult> AssignAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track source,
        Track target,
        string relationTypeCode,
        bool markTargetAsOriginal,
        CancellationToken cancellationToken)
    {
        return EvaluateAsync(
            context,
            collectionId,
            source,
            target,
            relationTypeCode,
            markTargetAsOriginal,
            assign: true,
            cancellationToken);
    }

    private async Task<TrackStackAssignmentResult> EvaluateAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track source,
        Track target,
        string relationTypeCode,
        bool markTargetAsOriginal,
        bool assign,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(target);
        ArgumentException.ThrowIfNullOrWhiteSpace(relationTypeCode);

        TrackStackAssignmentFailure scopeFailure =
            GetScopeFailure(collectionId, source, target);
        if (scopeFailure != TrackStackAssignmentFailure.None)
        {
            return Failure(scopeFailure);
        }

        IReadOnlyCollection<TrackRelation> currentRelations =
            await LoadCurrentRelationsAsync(
                context,
                collectionId,
                cancellationToken);
        TrackRelation? existing = FindIdenticalRelation(
            currentRelations,
            source.Id,
            target.Id,
            relationTypeCode);
        if (existing is not null)
        {
            return await CompleteExistingAsync(
                context,
                collectionId,
                target,
                existing,
                currentRelations,
                markTargetAsOriginal,
                assign,
                cancellationToken);
        }

        string relationType =
            await DictionaryValidation.RequireActiveCodeAsync(
                context,
                collectionId,
                DictionaryKind.TrackRelationType,
                relationTypeCode,
                TrackRelationTypeInvalidCode,
                TrackRelationTypeInvalidMessage,
                cancellationToken);
        IReadOnlyList<string> configuredTypeCodes =
            await TrackStackSettingsReader
                .GetDefaultRelationTypeCodesAsync(
                    context,
                    collectionId,
                    cancellationToken);
        TrackStackGraph graph = await LoadGraphAsync(
            context,
            collectionId,
            configuredTypeCodes,
            currentRelations,
            cancellationToken);
        TrackStackAssignmentFailure failure = MapFailure(
            _validator.ValidateNew(
                source,
                target,
                relationType,
                configuredTypeCodes,
                graph,
                markTargetAsOriginal));
        if (failure != TrackStackAssignmentFailure.None)
        {
            return Failure(failure);
        }

        if (!assign)
        {
            return Success(relation: null, wasCreated: true);
        }

        var relation = TrackRelation.Create(
            TrackRelationId.New(),
            collectionId,
            source.Id,
            target.Id,
            relationType);
        _ = context.TrackRelations.Add(relation);
        if (markTargetAsOriginal)
        {
            target.UpdateMetadata(
                target.Metadata.WithOriginalMarker(true));
        }

        return Success(relation, wasCreated: true);
    }

    private static TrackStackAssignmentFailure GetScopeFailure(
        CollectionId collectionId,
        Track source,
        Track target)
    {
        return true switch
        {
            _ when source.CollectionId != collectionId =>
                TrackStackAssignmentFailure.SourceCollectionMismatch,
            _ when target.CollectionId != collectionId =>
                TrackStackAssignmentFailure.TargetCollectionMismatch,
            _ when source.Id == target.Id =>
                TrackStackAssignmentFailure.SelfRelation,
            _ => TrackStackAssignmentFailure.None
        };
    }

    private static async Task<TrackStackAssignmentResult>
        CompleteExistingAsync(
            DiscWeaveDbContext context,
            CollectionId collectionId,
            Track target,
            TrackRelation existing,
            IReadOnlyCollection<TrackRelation> currentRelations,
            bool markTargetAsOriginal,
            bool assign,
            CancellationToken cancellationToken)
    {
        if (markTargetAsOriginal && !target.Metadata.IsOriginal)
        {
            IReadOnlyList<string> configuredTypeCodes =
                await TrackStackSettingsReader
                    .GetDefaultRelationTypeCodesAsync(
                        context,
                        collectionId,
                        cancellationToken);
            string existingIdentity = Identity(existing);
            bool targetHasAnotherStackRelation = currentRelations.Any(
                relation =>
                    configuredTypeCodes.Contains(
                        relation.RelationType) &&
                    !string.Equals(
                        Identity(relation),
                        existingIdentity,
                        StringComparison.Ordinal) &&
                    (relation.SourceTrackId == target.Id ||
                        relation.TargetTrackId == target.Id));
            if (targetHasAnotherStackRelation)
            {
                return Failure(
                    TrackStackAssignmentFailure.TargetNotStandalone);
            }

            if (assign)
            {
                target.UpdateMetadata(
                    target.Metadata.WithOriginalMarker(true));
            }
        }

        return Success(existing, wasCreated: false);
    }

    private static TrackRelation? FindIdenticalRelation(
            IReadOnlyCollection<TrackRelation> currentRelations,
            TrackId sourceTrackId,
            TrackId targetTrackId,
            string relationTypeCode)
    {
        return currentRelations.SingleOrDefault(
            relation =>
                relation.SourceTrackId == sourceTrackId &&
                relation.TargetTrackId == targetTrackId &&
                string.Equals(
                    relation.RelationType,
                    relationTypeCode,
                    StringComparison.Ordinal));
    }

    private static async Task<IReadOnlyCollection<TrackRelation>>
        LoadCurrentRelationsAsync(
            DiscWeaveDbContext context,
            CollectionId collectionId,
            CancellationToken cancellationToken)
    {
        TrackRelation[] persistedRelations =
            await context.TrackRelations.AsNoTracking()
                .Where(relation =>
                    relation.CollectionId == collectionId)
                .ToArrayAsync(cancellationToken);
        Dictionary<
            TrackRelationId,
            (TrackRelation Relation, bool IsTracked)> relationsById =
            persistedRelations.ToDictionary(
                relation => relation.Id,
                relation => (relation, false));
        foreach (EntityEntry<TrackRelation> entry in
            context.ChangeTracker.Entries<TrackRelation>()
                .Where(entry =>
                    entry.Entity.CollectionId == collectionId))
        {
            if (entry.State == EntityState.Deleted)
            {
                _ = relationsById.Remove(entry.Entity.Id);
            }
            else if (entry.State != EntityState.Detached)
            {
                relationsById[entry.Entity.Id] =
                    (entry.Entity, true);
            }
        }

        Dictionary<string, TrackRelation> relationsByIdentity =
            new(StringComparer.Ordinal);
        foreach ((TrackRelation relation, _) in
            relationsById.Values.Where(current => !current.IsTracked))
        {
            relationsByIdentity[Identity(relation)] = relation;
        }

        foreach ((TrackRelation relation, _) in
            relationsById.Values.Where(current => current.IsTracked))
        {
            relationsByIdentity[Identity(relation)] = relation;
        }

        return [.. relationsByIdentity.Values];
    }

    private static async Task<TrackStackGraph> LoadGraphAsync(
            DiscWeaveDbContext context,
            CollectionId collectionId,
            IReadOnlyCollection<string> configuredTypeCodes,
            IReadOnlyCollection<TrackRelation> currentRelations,
            CancellationToken cancellationToken)
    {
        Track[] persistedTracks = await context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        Dictionary<TrackId, Track> tracksById =
            persistedTracks.ToDictionary(track => track.Id);
        foreach (EntityEntry<Track> entry in
            context.ChangeTracker.Entries<Track>()
                .Where(entry =>
                    entry.Entity.CollectionId == collectionId))
        {
            if (entry.State == EntityState.Deleted)
            {
                _ = tracksById.Remove(entry.Entity.Id);
            }
            else if (entry.State != EntityState.Detached)
            {
                tracksById[entry.Entity.Id] = entry.Entity;
            }
        }

        Track[] tracks = [.. tracksById.Values];
        TrackRelation[] relations =
        [
            .. currentRelations.Where(relation =>
                configuredTypeCodes.Contains(relation.RelationType))
        ];

        return new TrackStackGraph(tracks, relations);
    }

    private static string Identity(TrackRelation relation)
    {
        return TrackRelationIdentity.From(
            relation.SourceTrackId,
            relation.TargetTrackId,
            relation.RelationType).Value;
    }

    private static TrackStackAssignmentFailure MapFailure(
        TrackStackRelationValidationFailure failure)
    {
        return failure switch
        {
            TrackStackRelationValidationFailure.None =>
                TrackStackAssignmentFailure.None,
            TrackStackRelationValidationFailure
                .RelationTypeNotConfigured =>
                TrackStackAssignmentFailure
                    .RelationTypeNotConfigured,
            TrackStackRelationValidationFailure.Cycle =>
                TrackStackAssignmentFailure.Cycle,
            TrackStackRelationValidationFailure
                .SourceNotStandalone =>
                TrackStackAssignmentFailure.SourceNotStandalone,
            TrackStackRelationValidationFailure.TargetNotOriginal =>
                TrackStackAssignmentFailure.TargetNotOriginal,
            TrackStackRelationValidationFailure
                .TargetNotStandalone =>
                TrackStackAssignmentFailure.TargetNotStandalone,
            _ => throw new ArgumentOutOfRangeException(
                nameof(failure),
                failure,
                "Unknown stack validation failure")
        };
    }

    private static TrackStackAssignmentResult Failure(
        TrackStackAssignmentFailure failure)
    {
        return new TrackStackAssignmentResult
        {
            Failure = failure,
            Relation = null,
            WasCreated = false
        };
    }

    private static TrackStackAssignmentResult Success(
        TrackRelation? relation,
        bool wasCreated)
    {
        return new TrackStackAssignmentResult
        {
            Failure = TrackStackAssignmentFailure.None,
            Relation = relation,
            WasCreated = wasCreated
        };
    }
}
