using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace DiscWeave.Api.Features.TrackRelations;

public sealed partial class TrackStackAssignmentService
{
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
