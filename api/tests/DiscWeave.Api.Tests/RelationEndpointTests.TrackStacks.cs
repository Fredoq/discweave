using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    private static readonly string[] RemixOnlyStackRelationTypes = [" remixOf ", "remixOf"];
    private static readonly string[] VersionOnlyStackRelationTypes = ["versionOf"];
    private static readonly string[] InvalidStackRelationTypes = ["unknown"];

    [Fact(DisplayName = "Stack assignment service promotes a standalone target without saving or starting a transaction")]
    public async Task Stack_assignment_service_promotes_a_standalone_target_without_saving_or_starting_a_transaction()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Standalone Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Standalone Target");
            _ = await context.SaveChangesAsync();
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
            Assert.True(result.WasCreated);
            Assert.NotNull(result.Relation);
            Assert.True(target.Metadata.IsOriginal);
            Assert.Equal(source.Id, result.Relation.SourceTrackId);
            Assert.Equal(target.Id, result.Relation.TargetTrackId);
            Assert.Equal("versionOf", result.Relation.RelationType);
            Assert.Equal(EntityState.Added, context.Entry(result.Relation).State);
            Assert.Null(context.Database.CurrentTransaction);

            string connectionString = context.Database.GetConnectionString() ??
                throw new InvalidOperationException("Test database connection string is unavailable");
            DbContextOptions<DiscWeaveDbContext> verificationOptions =
                new DbContextOptionsBuilder<DiscWeaveDbContext>()
                    .UseSqlite(connectionString)
                    .Options;
            await using var verificationContext =
                new DiscWeaveDbContext(verificationOptions);
            Track persistedTarget = await verificationContext.Tracks
                .SingleAsync(
                    track => track.CollectionId == collectionId &&
                        track.Id == target.Id,
                    CancellationToken.None);

            Assert.False(persistedTarget.Metadata.IsOriginal);
            Assert.Empty(await verificationContext.TrackRelations
                .Where(relation => relation.CollectionId == collectionId)
                .ToArrayAsync(CancellationToken.None));
        }
    }

    [Fact(DisplayName = "Stack assignment validation does not mutate a standalone promotion")]
    public async Task Stack_assignment_validation_does_not_mutate_a_standalone_promotion()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Validation Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Validation Target");
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: true,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.True(result.WasCreated);
            Assert.Null(result.Relation);
            Assert.False(target.Metadata.IsOriginal);
            Assert.Empty(context.TrackRelations.Local);
            Assert.Null(context.Database.CurrentTransaction);
        }
    }

    [Fact(DisplayName = "Stack assignment service accepts an existing original root without promotion")]
    public async Task Stack_assignment_service_accepts_an_existing_original_root_without_promotion()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Existing Root Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Existing Root",
                isOriginal: true);
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.AssignAsync(
                context,
                collectionId,
                source,
                target,
                "remixOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.True(result.WasCreated);
            Assert.NotNull(result.Relation);
            Assert.True(target.Metadata.IsOriginal);
        }
    }

    [Fact(DisplayName = "Stack assignment service preserves invalid relation type errors")]
    public async Task Stack_assignment_service_preserves_invalid_relation_type_errors()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Invalid Type Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Invalid Type Target");
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            DomainException exception = await Assert.ThrowsAsync<DomainException>(
                () => service.ValidateAsync(
                    context,
                    collectionId,
                    source,
                    target,
                    "notAStackRelation",
                    markTargetAsOriginal: true,
                    CancellationToken.None));

            Assert.Equal("track_relation.type_invalid", exception.Code);
            Assert.False(target.Metadata.IsOriginal);
            Assert.Empty(context.TrackRelations.Local);
        }
    }

    [Fact(DisplayName = "Stack assignment service rejects active relation types not configured for stacks")]
    public async Task Stack_assignment_service_rejects_active_relation_types_not_configured_for_stacks()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync(["versionOf"]);
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Unconfigured Type Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Unconfigured Type Target");
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                source,
                target,
                "remixOf",
                markTargetAsOriginal: true,
                CancellationToken.None);

            Assert.False(result.IsSuccess);
            Assert.Equal(
                TrackStackAssignmentFailure.RelationTypeNotConfigured,
                result.Failure);
            Assert.False(result.WasCreated);
            Assert.Null(result.Relation);
        }
    }

}
