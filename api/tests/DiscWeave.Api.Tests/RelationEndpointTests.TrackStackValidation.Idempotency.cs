using System.Net;
using System.Text.Json;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using DiscWeave.Api.Http;
using Microsoft.AspNetCore.Http;
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

    [Fact(DisplayName = "Stack assignment service retries an identical relation after its type leaves stack settings")]
    public async Task Stack_assignment_service_retries_an_identical_relation_after_its_type_leaves_stack_settings()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Removed Type Identity Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Removed Type Identity Target",
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
            TrackStackSettings settings = await context.TrackStackSettings
                .SingleAsync(
                    item => item.CollectionId == collectionId,
                    CancellationToken.None);
            settings.UpdateDefaultRelationTypeCodes([]);
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
        }
    }

    [Fact(DisplayName = "Stack relation retries an identical relation idempotently")]
    public async Task Stack_relation_retries_an_identical_relation_idempotently()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Destination");
        (HttpStatusCode firstStatus, JsonElement firstBody) =
            await PostStackRelationAsync(client, sourceId, targetId);
        (HttpStatusCode retryStatus, JsonElement retryBody) =
            await PostStackRelationAsync(client, sourceId, targetId);
        Assert.Equal(HttpStatusCode.Created, firstStatus);
        Assert.Equal(HttpStatusCode.OK, retryStatus);
        Assert.Equal(
            firstBody.GetProperty("id").GetGuid(),
            retryBody.GetProperty("id").GetGuid());
        Assert.Equal(1, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation retry succeeds after its type is removed from stack settings")]
    public async Task Stack_relation_retry_succeeds_after_its_type_is_removed_from_stack_settings()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Destination");
        (HttpStatusCode firstStatus, JsonElement firstBody) =
            await PostStackRelationAsync(client, sourceId, targetId);
        await SetStackRelationTypesAsync(client);
        (HttpStatusCode retryStatus, JsonElement retryBody) =
            await PostStackRelationAsync(client, sourceId, targetId);
        Assert.Equal(HttpStatusCode.Created, firstStatus);
        Assert.Equal(HttpStatusCode.OK, retryStatus);
        Assert.Equal(
            firstBody.GetProperty("id").GetGuid(),
            retryBody.GetProperty("id").GetGuid());
        Assert.Equal(1, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation retry rejects promotion when the target has another configured member")]
    public async Task Stack_relation_retry_rejects_promotion_when_the_target_has_another_configured_member()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid otherMemberId = await CreateTrackAsync(client, "Other Member");
        Guid targetId = await CreateTrackAsync(client, "Destination");
        Guid existingRelationId = await CreateTrackRelationAsync(
            client,
            sourceId,
            targetId,
            "versionOf");
        Guid otherRelationId = await CreateTrackRelationAsync(
            client,
            otherMemberId,
            targetId,
            "remixOf");

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.stack_target_not_standalone");

        using HttpResponseMessage relationsResponse = await client.GetAsync(
            "/api/track-relations?limit=100&offset=0");
        using JsonDocument relationsDocument =
            await ReadJsonAsync(relationsResponse);
        Guid[] relationIds =
        [
            .. relationsDocument.RootElement.GetProperty("items")
                .EnumerateArray()
                .Select(item => item.GetProperty("id").GetGuid())
        ];
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(2, relationsDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Contains(existingRelationId, relationIds);
        Assert.Contains(otherRelationId, relationIds);
    }

    [Fact(DisplayName = "Stack relation retry rejects promotion when the target belongs to another stack")]
    public async Task Stack_relation_retry_rejects_promotion_when_the_target_belongs_to_another_stack()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Destination Member");
        Guid rootId = await CreateOriginalTrackAsync(client, "Existing Root");
        Guid existingRelationId = await CreateTrackRelationAsync(
            client,
            sourceId,
            targetId,
            "versionOf");
        Guid membershipRelationId = await CreateTrackRelationAsync(
            client,
            targetId,
            rootId,
            "remixOf");

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.stack_target_not_standalone");

        using HttpResponseMessage relationsResponse = await client.GetAsync(
            "/api/track-relations?limit=100&offset=0");
        using JsonDocument relationsDocument =
            await ReadJsonAsync(relationsResponse);
        Guid[] relationIds =
        [
            .. relationsDocument.RootElement.GetProperty("items")
                .EnumerateArray()
                .Select(item => item.GetProperty("id").GetGuid())
        ];
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(2, relationsDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Contains(existingRelationId, relationIds);
        Assert.Contains(membershipRelationId, relationIds);
    }

    [Fact(DisplayName = "Stack relation retry remains idempotent after the original target gains another member")]
    public async Task Stack_relation_retry_remains_idempotent_after_the_original_target_gains_another_member()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid otherMemberId = await CreateTrackAsync(client, "Other Member");
        Guid targetId = await CreateTrackAsync(client, "Destination");
        (HttpStatusCode firstStatus, JsonElement firstBody) =
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true);
        _ = await CreateTrackRelationAsync(
            client,
            otherMemberId,
            targetId,
            "remixOf");

        (HttpStatusCode retryStatus, JsonElement retryBody) =
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true);

        Assert.Equal(HttpStatusCode.Created, firstStatus);
        Assert.Equal(HttpStatusCode.OK, retryStatus);
        Assert.Equal(
            firstBody.GetProperty("id").GetGuid(),
            retryBody.GetProperty("id").GetGuid());
        Assert.True(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(2, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation persistence collisions roll back target promotion")]
    public async Task Stack_relation_persistence_collisions_roll_back_target_promotion()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Destination");
        var collidingRelationId = Guid.CreateVersion7();
        await host.ExecuteSqlAsync(
            $$"""
            CREATE TRIGGER inject_track_relation_identity_collision
            BEFORE INSERT ON track_relations
            WHEN NEW.track_relation_id <> '{{collidingRelationId:D}}'
            BEGIN
                INSERT INTO track_relations (
                    track_relation_id,
                    collection_id,
                    source_track_id,
                    target_track_id,
                    relation_type,
                    identity_key)
                VALUES (
                    '{{collidingRelationId:D}}',
                    NEW.collection_id,
                    NEW.source_track_id,
                    NEW.target_track_id,
                    NEW.relation_type,
                    NEW.identity_key);
            END;
            """);

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.duplicate");
        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(0, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation identity collisions map to the duplicate error")]
    public void Stack_relation_identity_collisions_map_to_the_duplicate_error()
    {
        IResult result = TrackRelationsEndpointRouteBuilderExtensions
            .StackRelationIdentityConflict();
        IStatusCodeHttpResult statusResult =
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        IValueHttpResult valueResult =
            Assert.IsAssignableFrom<IValueHttpResult>(result);
        ErrorResponse error = Assert.IsType<ErrorResponse>(valueResult.Value);

        Assert.Equal(StatusCodes.Status409Conflict, statusResult.StatusCode);
        Assert.Equal("track_relation.duplicate", error.Code);
        Assert.Equal("Track relation already exists", error.Message);
    }
}
