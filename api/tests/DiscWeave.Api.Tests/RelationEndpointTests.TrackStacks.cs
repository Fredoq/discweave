using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    private static readonly string[] RemixOnlyStackRelationTypes = [" remixOf ", "remixOf"];
    private static readonly string[] InvalidStackRelationTypes = ["unknown"];

    [Fact(DisplayName = "Track stack settings expose defaults and filter stack traversal")]
    public async Task Track_stack_settings_expose_defaults_and_filter_stack_traversal()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid originalId = await CreateTrackAsync(client, "Blue Monday");
        Guid remixId = await CreateTrackAsync(client, "Blue Monday (Hardfloor Mix)");
        Guid versionId = await CreateTrackAsync(client, "Blue Monday (Edit)");
        await MarkOriginalAsync(client, originalId, "Blue Monday", 1983);
        _ = await CreateTrackRelationAsync(client, remixId, originalId, "remixOf");
        _ = await CreateTrackRelationAsync(client, versionId, originalId, "versionOf");

        using HttpResponseMessage defaultsResponse = await client.GetAsync("/api/settings/track-stack");
        using JsonDocument defaultsDocument = await ReadJsonAsync(defaultsResponse);

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            "/api/settings/track-stack",
            new { defaultRelationTypeCodes = RemixOnlyStackRelationTypes });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        using HttpResponseMessage invalidResponse = await client.PutAsJsonAsync(
            "/api/settings/track-stack",
            new { defaultRelationTypeCodes = InvalidStackRelationTypes });
        using JsonDocument invalidDocument = await ReadJsonAsync(invalidResponse);

        using HttpResponseMessage stacksResponse = await client.GetAsync("/api/tracks/stacks");
        using JsonDocument stacksDocument = await ReadJsonAsync(stacksResponse);

        Assert.Equal(HttpStatusCode.OK, defaultsResponse.StatusCode);
        string[] defaultCodes =
        [
            .. defaultsDocument.RootElement.GetProperty("defaultRelationTypeCodes")
                .EnumerateArray()
                .Select(item => item.GetString() ?? string.Empty)
        ];
        Assert.Equal(["remixOf", "versionOf"], defaultCodes);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal("remixOf", updateDocument.RootElement.GetProperty("defaultRelationTypeCodes")[0].GetString());
        Assert.Equal(1, updateDocument.RootElement.GetProperty("defaultRelationTypeCodes").GetArrayLength());
        Assert.Equal(HttpStatusCode.BadRequest, invalidResponse.StatusCode);
        Assert.Equal("track_stack_settings.relation_type_invalid", invalidDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, stacksResponse.StatusCode);
        JsonElement stack = stacksDocument.RootElement.GetProperty("items")[0];
        Assert.Equal(originalId, stack.GetProperty("originalTrackId").GetGuid());
        Assert.Equal(1, stack.GetProperty("memberCount").GetInt32());
        Assert.Equal(remixId, stack.GetProperty("members")[0].GetProperty("trackId").GetGuid());
    }

    [Fact(DisplayName = "Track stacks are transitive, deduplicated, and cycle safe")]
    public async Task Track_stacks_are_transitive_deduplicated_and_cycle_safe()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid originalId = await CreateTrackAsync(client, "Confusion");
        Guid versionId = await CreateTrackAsync(client, "Confusion (Edit)");
        Guid remixId = await CreateTrackAsync(client, "Confusion (Warehouse Mix)");
        Guid bootlegId = await CreateTrackAsync(client, "Confusion (Bootleg Dub)");
        await MarkOriginalAsync(client, originalId, "Confusion", 1983);
        _ = await CreateTrackRelationAsync(client, versionId, originalId, "versionOf");
        _ = await CreateTrackRelationAsync(client, remixId, versionId, "remixOf");
        _ = await CreateTrackRelationAsync(client, remixId, originalId, "versionOf");
        _ = await CreateTrackRelationAsync(client, bootlegId, remixId, "remixOf");
        _ = await CreateTrackRelationAsync(client, originalId, bootlegId, "versionOf");

        using HttpResponseMessage response = await client.GetAsync("/api/tracks/stacks");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement stack = document.RootElement.GetProperty("items")[0];
        JsonElement members = stack.GetProperty("members");
        Guid[] memberIds = [.. members.EnumerateArray().Select(member => member.GetProperty("trackId").GetGuid())];
        Assert.Equal(3, stack.GetProperty("memberCount").GetInt32());
        Assert.Equal(memberIds.Distinct().Count(), memberIds.Length);
        Assert.Contains(versionId, memberIds);
        Assert.Contains(remixId, memberIds);
        Assert.Contains(bootlegId, memberIds);
        JsonElement remixMember = members.EnumerateArray().Single(member => member.GetProperty("trackId").GetGuid() == remixId);
        Assert.True(remixMember.GetProperty("isDirect").GetBoolean());
        Assert.Equal(1, remixMember.GetProperty("depth").GetInt32());
        JsonElement bootlegMember = members.EnumerateArray().Single(member => member.GetProperty("trackId").GetGuid() == bootlegId);
        Assert.False(bootlegMember.GetProperty("isDirect").GetBoolean());
        Assert.Equal(2, bootlegMember.GetProperty("depth").GetInt32());
        Assert.True(stack.GetProperty("hasCycleIssue").GetBoolean());
        Assert.Contains(
            stack.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "track_stack.cycle");
    }

    private static async Task MarkOriginalAsync(HttpClient client, Guid trackId, string title, int versionYear)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/tracks/{trackId}",
            new
            {
                title,
                versionYear,
                isOriginal = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                credits = Array.Empty<object>(),
                releaseAppearances = Array.Empty<object>()
            });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(document.RootElement.GetProperty("isOriginal").GetBoolean());
    }

    private static async Task<Guid> CreateTrackRelationAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid targetTrackId,
        string type)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId, targetTrackId, type });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }
}
