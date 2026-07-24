using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack assignment service reuses an identical persisted relation")]
    public async Task Stack_assignment_service_reuses_an_identical_persisted_relation()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Persisted Identity Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Persisted Identity Target",
                isOriginal: true);
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
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.False(result.WasCreated);
            Assert.Same(existing, result.Relation);
            _ = Assert.Single(context.TrackRelations.Local);
        }
    }

    [Fact(DisplayName = "Stack assignment service reconciles an updated persisted relation by stable id")]
    public async Task Stack_assignment_service_reconciles_an_updated_persisted_relation_by_stable_id()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track oldSource = AddStackAssignmentTrack(
                context,
                collectionId,
                "Updated Identity Old Source");
            Track oldTarget = AddStackAssignmentTrack(
                context,
                collectionId,
                "Updated Identity Old Target",
                isOriginal: true);
            Track currentSource = AddStackAssignmentTrack(
                context,
                collectionId,
                "Updated Identity Current Source");
            Track currentTarget = AddStackAssignmentTrack(
                context,
                collectionId,
                "Updated Identity Current Target",
                isOriginal: true);
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
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult oldIdentityResult =
                await service.AssignAsync(
                    context,
                    collectionId,
                    oldSource,
                    oldTarget,
                    "versionOf",
                    markTargetAsOriginal: false,
                    CancellationToken.None);
            TrackStackAssignmentResult reverseCurrentIdentityResult =
                await service.ValidateAsync(
                    context,
                    collectionId,
                    currentTarget,
                    currentSource,
                    "remixOf",
                    markTargetAsOriginal: true,
                    CancellationToken.None);

            Assert.True(oldIdentityResult.IsSuccess);
            Assert.True(oldIdentityResult.WasCreated);
            Assert.NotNull(oldIdentityResult.Relation);
            Assert.NotEqual(persistedId, oldIdentityResult.Relation.Id);
            Assert.Equal(oldSource.Id, oldIdentityResult.Relation.SourceTrackId);
            Assert.Equal(oldTarget.Id, oldIdentityResult.Relation.TargetTrackId);
            Assert.Equal(
                TrackStackAssignmentFailure.Cycle,
                reverseCurrentIdentityResult.Failure);
            _ = Assert.Single(
                context.TrackRelations.Local,
                relation => relation.Id == persistedId);
        }
    }

    [Fact(DisplayName = "Stack assignment service returns the current tracked identity for an updated persisted relation")]
    public async Task Stack_assignment_service_returns_the_current_tracked_identity_for_an_updated_persisted_relation()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track oldSource = AddStackAssignmentTrack(
                context,
                collectionId,
                "Current Result Old Source");
            Track oldTarget = AddStackAssignmentTrack(
                context,
                collectionId,
                "Current Result Old Target");
            Track currentSource = AddStackAssignmentTrack(
                context,
                collectionId,
                "Current Result Source");
            Track currentTarget = AddStackAssignmentTrack(
                context,
                collectionId,
                "Current Result Target");
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
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.AssignAsync(
                context,
                collectionId,
                currentSource,
                currentTarget,
                "remixOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.False(result.WasCreated);
            Assert.Same(tracked, result.Relation);
            TrackRelation current = Assert.IsType<TrackRelation>(
                result.Relation);
            Assert.Equal(persistedId, current.Id);
            Assert.Equal(currentSource.Id, current.SourceTrackId);
            Assert.Equal(currentTarget.Id, current.TargetTrackId);
            Assert.Equal("remixOf", current.RelationType);
        }
    }
}
