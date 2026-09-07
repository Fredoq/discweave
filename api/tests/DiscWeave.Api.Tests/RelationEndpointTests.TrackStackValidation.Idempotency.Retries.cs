using System.Net;
using System.Text.Json;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
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

    [Fact(DisplayName = "Stack relation retry promotes a target with another configured member")]
    public async Task Stack_relation_retry_promotes_a_target_with_another_configured_member()
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

        (HttpStatusCode retryStatus, JsonElement retryBody) =
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true);

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
        Assert.Equal(HttpStatusCode.OK, retryStatus);
        Assert.Equal(existingRelationId, retryBody.GetProperty("id").GetGuid());
        Assert.True(await GetTrackIsOriginalAsync(client, targetId));
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
}
