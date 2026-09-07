using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack relation rejects promotion of an already-original target that is a member")]
    public async Task Stack_relation_rejects_promotion_of_an_already_original_target_that_is_a_member()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Existing Member");
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
        Assert.True(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(beforeCount, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation retry rejects an already-original member target")]
    public async Task Stack_relation_retry_rejects_an_already_original_member_target()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Existing Member");
        Guid rootId = await CreateOriginalTrackAsync(client, "Existing Root");
        _ = await CreateTrackRelationAsync(client, sourceId, targetId, "versionOf");
        _ = await CreateTrackRelationAsync(client, targetId, rootId, "versionOf");

        (HttpStatusCode status, JsonElement body) = await PostStackRelationAsync(
            client,
            sourceId,
            targetId,
            markTargetAsOriginal: true);

        Assert.Equal(HttpStatusCode.Conflict, status);
        Assert.Equal(
            "track_relation.stack_target_not_standalone",
            body.GetProperty("code").GetString());
        Assert.Equal(
            "Target track belongs to another stack",
            body.GetProperty("message").GetString());
        Assert.True(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(2, await GetTrackRelationTotalAsync(client));
    }
}
