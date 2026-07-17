using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Track stacks report cycles that connect independently discovered branches")]
    public async Task Track_stacks_report_cycles_that_connect_independently_discovered_branches()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid rootId = await CreateTrackAsync(client, "Root");
        Guid firstBranchId = await CreateTrackAsync(client, "First Branch");
        Guid secondBranchId = await CreateTrackAsync(client, "Second Branch");
        Guid sharedMemberId = await CreateTrackAsync(client, "Shared Member");
        await MarkOriginalAsync(client, rootId, "Root", 2000);
        _ = await CreateTrackRelationAsync(
            client,
            firstBranchId,
            rootId,
            "versionOf");
        _ = await CreateTrackRelationAsync(
            client,
            secondBranchId,
            rootId,
            "versionOf");
        _ = await CreateTrackRelationAsync(
            client,
            sharedMemberId,
            firstBranchId,
            "remixOf");
        _ = await CreateTrackRelationAsync(
            client,
            sharedMemberId,
            secondBranchId,
            "versionOf");
        _ = await CreateTrackRelationAsync(
            client,
            secondBranchId,
            sharedMemberId,
            "remixOf");

        using HttpResponseMessage response = await client.GetAsync(
            "/api/tracks/stacks");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement stack = document.RootElement.GetProperty("items")[0];
        Assert.Equal(3, stack.GetProperty("memberCount").GetInt32());
        Assert.True(stack.GetProperty("hasCycleIssue").GetBoolean());
        Assert.Contains(
            stack.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "track_stack.cycle");
    }
}
