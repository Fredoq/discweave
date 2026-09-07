using System.Net;
using System.Text.Json;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Theory(DisplayName = "Stack assignment service rejects tracks outside the requested collection")]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Stack_assignment_service_rejects_tracks_outside_the_requested_collection(
        bool sourceIsForeign)
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            var foreignCollectionId = CollectionId.New();
            Track source = AddStackAssignmentTrack(
                context,
                sourceIsForeign ? foreignCollectionId : collectionId,
                "Collection Scope Source");
            Track target = AddStackAssignmentTrack(
                context,
                sourceIsForeign ? collectionId : foreignCollectionId,
                "Collection Scope Target",
                isOriginal: true);
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.False(result.IsSuccess);
            Assert.Equal(
                sourceIsForeign
                    ? TrackStackAssignmentFailure.SourceCollectionMismatch
                    : TrackStackAssignmentFailure.TargetCollectionMismatch,
                result.Failure);
            Assert.False(result.WasCreated);
            Assert.Null(result.Relation);
        }
    }

    [Fact(DisplayName = "Stack assignment service rejects promotion of a target that is itself a stack member")]
    public async Task Stack_assignment_service_rejects_promotion_of_a_target_that_is_itself_a_stack_member()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Target Conflict Source");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Target Conflict Member");
            Track currentRoot = AddStackAssignmentTrack(
                context,
                collectionId,
                "Target Conflict Root",
                isOriginal: true);
            _ = context.TrackRelations.Add(
                TrackRelation.Create(
                    TrackRelationId.New(),
                    collectionId,
                    target.Id,
                    currentRoot.Id,
                    "remixOf"));
            _ = await context.SaveChangesAsync(
                CancellationToken.None);
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

            Assert.False(result.IsSuccess);
            Assert.Equal(
                TrackStackAssignmentFailure.TargetNotStandalone,
                result.Failure);
            Assert.False(target.Metadata.IsOriginal);
        }
    }

    [Fact(DisplayName = "Stack relation hides unknown and foreign tracks identically")]
    public async Task Stack_relation_hides_unknown_and_foreign_tracks_identically()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient adminClient, HttpClient userClient) =
            await CreateStackRelationClientsAsync(host);
        Guid sourceId = await CreateTrackAsync(adminClient, "Source");
        Guid foreignTargetId = await CreateTrackAsync(userClient, "Foreign Target");
        Guid foreignSourceId = await CreateTrackAsync(userClient, "Foreign Source");
        Guid ownTargetId = await CreateOriginalTrackAsync(adminClient, "Own Target");

        (HttpStatusCode unknownStatus, JsonElement unknownBody) =
            await PostStackRelationAsync(
                adminClient,
                sourceId,
                Guid.CreateVersion7());
        (HttpStatusCode foreignStatus, JsonElement foreignBody) =
            await PostStackRelationAsync(
                adminClient,
                sourceId,
                foreignTargetId);
        (HttpStatusCode unknownSourceStatus, JsonElement unknownSourceBody) =
            await PostStackRelationAsync(
                adminClient,
                Guid.CreateVersion7(),
                ownTargetId);
        (HttpStatusCode foreignSourceStatus, JsonElement foreignSourceBody) =
            await PostStackRelationAsync(
                adminClient,
                foreignSourceId,
                ownTargetId);

        AssertStackError(
            (unknownStatus, unknownBody),
            HttpStatusCode.NotFound,
            "track_relation.track_conflict");
        AssertStackError(
            (foreignStatus, foreignBody),
            HttpStatusCode.NotFound,
            "track_relation.track_conflict");
        AssertStackError(
            (unknownSourceStatus, unknownSourceBody),
            HttpStatusCode.NotFound,
            "track_relation.track_conflict");
        AssertStackError(
            (foreignSourceStatus, foreignSourceBody),
            HttpStatusCode.NotFound,
            "track_relation.track_conflict");
        Assert.Equal(unknownBody.GetRawText(), foreignBody.GetRawText());
        Assert.Equal(unknownBody.GetRawText(), unknownSourceBody.GetRawText());
        Assert.Equal(unknownBody.GetRawText(), foreignSourceBody.GetRawText());
    }

    [Fact(DisplayName = "Stack relation requires an original target when promotion is false")]
    public async Task Stack_relation_requires_an_original_target_when_promotion_is_false()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Target");
        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: false),
            HttpStatusCode.Conflict,
            "track_relation.stack_target_not_original");
    }

    [Fact(DisplayName = "Stack relation accepts an empty original target without promotion")]
    public async Task Stack_relation_accepts_an_empty_original_target_without_promotion()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Empty Root");
        (HttpStatusCode status, JsonElement body) =
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: false);
        Assert.Equal(HttpStatusCode.Created, status);
        Assert.Equal(sourceId, body.GetProperty("sourceTrackId").GetGuid());
        Assert.Equal(targetId, body.GetProperty("targetTrackId").GetGuid());
    }

    [Fact(DisplayName = "Stack relation promotes a target that has members without rewriting relation endpoints")]
    public async Task Stack_relation_promotes_a_target_that_has_members_without_rewriting_relation_endpoints()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Legacy Root");
        Guid memberId = await CreateTrackAsync(client, "Existing Member");
        _ = await CreateTrackRelationAsync(
            client,
            memberId,
            targetId,
            "versionOf");
        (HttpStatusCode status, JsonElement body) = await PostStackRelationAsync(
            client,
            sourceId,
            targetId,
            markTargetAsOriginal: true);

        Assert.Equal(HttpStatusCode.Created, status);
        Assert.Equal(sourceId, body.GetProperty("sourceTrackId").GetGuid());
        Assert.Equal(targetId, body.GetProperty("targetTrackId").GetGuid());
        Assert.True(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(2, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation rejects promotion of a target that belongs to another stack")]
    public async Task Stack_relation_rejects_promotion_of_a_target_that_belongs_to_another_stack()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Existing Member");
        Guid rootId = await CreateOriginalTrackAsync(client, "Existing Root");
        _ = await CreateTrackRelationAsync(
            client,
            targetId,
            rootId,
            "versionOf");
        int beforeCount = await GetTrackRelationTotalAsync(client);

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.stack_target_not_standalone");
        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(beforeCount, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Failed stack relation validation leaves tracks and relations unchanged")]
    public async Task Failed_stack_relation_validation_leaves_tracks_and_relations_unchanged()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Member Source");
        Guid currentRootId = await CreateOriginalTrackAsync(client, "Current Root");
        Guid targetId = await CreateTrackAsync(client, "New Target");
        _ = await CreateTrackRelationAsync(
            client,
            sourceId,
            currentRootId,
            "versionOf");
        int beforeCount = await GetTrackRelationTotalAsync(client);

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.stack_source_not_standalone");
        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(beforeCount, await GetTrackRelationTotalAsync(client));
    }
}
