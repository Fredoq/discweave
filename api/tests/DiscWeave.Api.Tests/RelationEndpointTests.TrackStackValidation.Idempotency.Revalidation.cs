using System.Net;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack relation retry revalidates settings before pending promotion")]
    public async Task Stack_relation_retry_revalidates_settings_before_pending_promotion()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Destination");
        _ = await CreateTrackRelationAsync(
            client,
            sourceId,
            targetId,
            "versionOf");
        await SetStackRelationTypesAsync(client);

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.BadRequest,
            "track_relation.stack_type_invalid");

        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(1, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation retry revalidates a stale source before pending promotion")]
    public async Task Stack_relation_retry_revalidates_a_stale_source_before_pending_promotion()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Destination");
        Guid otherRootId = await CreateOriginalTrackAsync(
            client,
            "Other Root");
        _ = await CreateTrackRelationAsync(
            client,
            sourceId,
            targetId,
            "versionOf");
        _ = await CreateTrackRelationAsync(
            client,
            sourceId,
            otherRootId,
            "remixOf");

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.stack_source_not_standalone");

        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(2, await GetTrackRelationTotalAsync(client));
    }
}
