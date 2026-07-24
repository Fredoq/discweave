using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack assignment service promotes an identical persisted relation target")]
    public async Task Stack_assignment_service_promotes_an_identical_persisted_relation_target()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Persisted Promotion Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Persisted Promotion Target");
            var existing = TrackRelation.Create(
                TrackRelationId.New(),
                collectionId,
                source.Id,
                target.Id,
                "versionOf");
            _ = context.TrackRelations.Add(existing);
            _ = await context.SaveChangesAsync(
                CancellationToken.None);
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.AssignAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: true,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.False(result.WasCreated);
            Assert.Same(existing, result.Relation);
            Assert.True(target.Metadata.IsOriginal);
            Assert.Equal(EntityState.Modified, context.Entry(target).State);
        }
    }

    [Fact(DisplayName = "Stack assignment service reuses an identical local relation before checking stack settings")]
    public async Task Stack_assignment_service_reuses_an_identical_local_relation_before_checking_stack_settings()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync([]);
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Local Identity Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Local Identity Target");
            var existing = TrackRelation.Create(
                TrackRelationId.New(),
                collectionId,
                source.Id,
                target.Id,
                "versionOf");
            _ = context.TrackRelations.Add(existing);
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.AssignAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.False(result.WasCreated);
            Assert.Same(existing, result.Relation);
            Assert.Equal(2, context.Tracks.Local.Count);
            _ = Assert.Single(context.TrackRelations.Local);
        }
    }

    [Fact(DisplayName = "Stack assignment service suppresses a deleted updated persisted relation by stable id")]
    public async Task Stack_assignment_service_suppresses_a_deleted_updated_persisted_relation_by_stable_id()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track oldSource = AddStackAssignmentTrack(
                context,
                collectionId,
                "Deleted Persisted Old Source");
            Track oldTarget = AddStackAssignmentTrack(
                context,
                collectionId,
                "Deleted Persisted Old Target",
                isOriginal: true);
            Track currentSource = AddStackAssignmentTrack(
                context,
                collectionId,
                "Deleted Persisted Current Source");
            Track currentTarget = AddStackAssignmentTrack(
                context,
                collectionId,
                "Deleted Persisted Current Target");
            var persisted = TrackRelation.Create(
                TrackRelationId.New(),
                collectionId,
                oldSource.Id,
                oldTarget.Id,
                "versionOf");
            _ = context.TrackRelations.Add(persisted);
            _ = await context.SaveChangesAsync(
                CancellationToken.None);
            TrackRelationId persistedId = persisted.Id;
            context.ChangeTracker.Clear();

            TrackRelation tracked = await context.TrackRelations.SingleAsync(
                relation => relation.Id == persistedId,
                CancellationToken.None);
            tracked.Update(
                currentSource.Id,
                currentTarget.Id,
                "remixOf");
            _ = context.TrackRelations.Remove(tracked);
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            Assert.Equal(
                EntityState.Deleted,
                context.Entry(tracked).State);

            TrackStackAssignmentResult result = await service.AssignAsync(
                context,
                collectionId,
                oldSource,
                oldTarget,
                "versionOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.True(result.WasCreated);
            Assert.NotNull(result.Relation);
            Assert.NotEqual(persistedId, result.Relation.Id);
            Assert.Equal(oldSource.Id, result.Relation.SourceTrackId);
            Assert.Equal(oldTarget.Id, result.Relation.TargetTrackId);
            _ = Assert.Single(context.TrackRelations.Local);
        }
    }
}
