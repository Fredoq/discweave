using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Promoting a standalone track re-roots the stack and re-attaches old members")]
    public async Task Promoting_a_standalone_track_re_roots_the_stack_and_re_attaches_old_members()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid extendedId = await CreateOriginalTrackAsync(client, "Bounce (Extended Mix)");
        Guid radioEditId = await CreateTrackAsync(client, "Bounce (Radio Edit)");
        Guid albumId = await CreateTrackAsync(client, "Bounce");
        _ = await PostStackRelationAsync(client, radioEditId, extendedId);

        (HttpStatusCode status, JsonElement body) = await PostPromoteOriginalAsync(client, albumId, extendedId);

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(extendedId, body.GetProperty("sourceTrackId").GetGuid());
        Assert.Equal(albumId, body.GetProperty("targetTrackId").GetGuid());
        Assert.True(await GetTrackIsOriginalAsync(client, albumId));
        Assert.False(await GetTrackIsOriginalAsync(client, extendedId));
        JsonElement stack = await SingleStackAsync(client);
        Assert.Equal(albumId, stack.GetProperty("originalTrackId").GetGuid());
        JsonElement radioEdit = stack.GetProperty("members").EnumerateArray()
            .Single(member => member.GetProperty("trackId").GetGuid() == radioEditId);
        Assert.Equal(1, radioEdit.GetProperty("depth").GetInt32());
        Assert.True(radioEdit.GetProperty("isDirect").GetBoolean());
        Assert.Equal(2, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Promoting a stack member replaces its link to the old original")]
    public async Task Promoting_a_stack_member_replaces_its_link_to_the_old_original()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid extendedId = await CreateOriginalTrackAsync(client, "Bounce (Extended Mix)");
        Guid radioEditId = await CreateTrackAsync(client, "Bounce (Radio Edit)");
        Guid albumId = await CreateTrackAsync(client, "Bounce");
        _ = await PostStackRelationAsync(client, radioEditId, extendedId);
        _ = await PostStackRelationAsync(client, albumId, extendedId);

        (HttpStatusCode status, _) = await PostPromoteOriginalAsync(client, albumId, extendedId, "remixOf");

        Assert.Equal(HttpStatusCode.OK, status);
        Assert.Equal(2, await GetTrackRelationTotalAsync(client));
        JsonElement stack = await SingleStackAsync(client);
        Assert.Equal(albumId, stack.GetProperty("originalTrackId").GetGuid());
        Assert.Equal(2, stack.GetProperty("memberCount").GetInt32());
        JsonElement extended = stack.GetProperty("members").EnumerateArray()
            .Single(member => member.GetProperty("trackId").GetGuid() == extendedId);
        Assert.Equal("remixOf", extended.GetProperty("relationType").GetString());
    }

    [Fact(DisplayName = "Promoting a track from another stack is rejected without changes")]
    public async Task Promoting_a_track_from_another_stack_is_rejected_without_changes()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid firstId = await CreateOriginalTrackAsync(client, "Bounce (Extended Mix)");
        Guid secondId = await CreateOriginalTrackAsync(client, "Awooga");
        Guid secondMemberId = await CreateTrackAsync(client, "Awooga (Edit)");
        _ = await PostStackRelationAsync(client, secondMemberId, secondId);

        (HttpStatusCode, JsonElement) otherStack = await PostPromoteOriginalAsync(client, secondMemberId, firstId);
        (HttpStatusCode, JsonElement) notRoot = await PostPromoteOriginalAsync(client, firstId, secondMemberId);

        AssertStackError(otherStack, HttpStatusCode.Conflict, "track_relation.stack_new_original_invalid");
        AssertStackError(notRoot, HttpStatusCode.Conflict, "track_relation.stack_current_original_invalid");
        Assert.True(await GetTrackIsOriginalAsync(client, firstId));
        Assert.Equal(1, await GetTrackRelationTotalAsync(client));
    }

    private static async Task<(HttpStatusCode Status, JsonElement Body)> PostPromoteOriginalAsync(
        HttpClient client,
        Guid newOriginalTrackId,
        Guid currentOriginalTrackId,
        string type = "versionOf")
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations/stack/original",
            new { newOriginalTrackId, currentOriginalTrackId, type });
        using JsonDocument document = await ReadJsonAsync(response);
        return (response.StatusCode, document.RootElement.Clone());
    }

    private static async Task<JsonElement> SingleStackAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync("/api/tracks/stacks");
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return Assert.Single(document.RootElement.GetProperty("items").EnumerateArray()).Clone();
    }
}
