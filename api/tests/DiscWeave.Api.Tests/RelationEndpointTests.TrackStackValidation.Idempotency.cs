using System.Net;
using System.Text.Json;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Api.Http;
using Microsoft.AspNetCore.Http;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
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
