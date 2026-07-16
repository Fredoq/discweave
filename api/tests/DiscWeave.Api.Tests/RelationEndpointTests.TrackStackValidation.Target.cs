using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
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
            HttpStatusCode.Conflict,
            "track_relation.track_conflict");
        AssertStackError(
            (foreignStatus, foreignBody),
            HttpStatusCode.Conflict,
            "track_relation.track_conflict");
        AssertStackError(
            (unknownSourceStatus, unknownSourceBody),
            HttpStatusCode.Conflict,
            "track_relation.track_conflict");
        AssertStackError(
            (foreignSourceStatus, foreignSourceBody),
            HttpStatusCode.Conflict,
            "track_relation.track_conflict");
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

    [Fact(DisplayName = "Stack relation rejects promotion of a target that has members atomically")]
    public async Task Stack_relation_rejects_promotion_of_a_target_that_has_members_atomically()
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
