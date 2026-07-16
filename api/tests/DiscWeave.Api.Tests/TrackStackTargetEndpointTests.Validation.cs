using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackStackTargetEndpointTests
{
    [Fact(DisplayName = "Stack target search validates source query and pagination")]
    public async Task Stack_target_search_validates_source_query_and_pagination()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming Track");

        AssertError(
            await GetJsonAsync(client, TargetUrl(null, "ab")),
            HttpStatusCode.BadRequest,
            "track_stack.source_required");
        foreach (string invalidSearch in new[] { "", " ", "a", " a " })
        {
            AssertError(
                await GetJsonAsync(client, TargetUrl(sourceId, invalidSearch)),
                HttpStatusCode.BadRequest,
                "track_stack.search_invalid");
        }
        Assert.Equal(
            HttpStatusCode.OK,
            (await GetJsonAsync(
                client,
                TargetUrl(sourceId, new string('a', 200)))).Status);
        AssertError(
            await GetJsonAsync(
                client,
                TargetUrl(sourceId, new string('a', 201))),
            HttpStatusCode.BadRequest,
            "track_stack.search_invalid");
        foreach ((int? Offset, int? Limit) invalid in
            new (int?, int?)[] { (-1, 20), (0, 0), (0, -1) })
        {
            AssertError(
                await GetJsonAsync(
                    client,
                    TargetUrl(sourceId, "ab", invalid.Offset, invalid.Limit)),
                HttpStatusCode.BadRequest,
                "pagination.invalid");
        }

        using JsonDocument defaults = await GetTargetsAsync(client, sourceId, "zz");
        Assert.Equal(20, defaults.RootElement.GetProperty("limit").GetInt32());
        Assert.Equal(0, defaults.RootElement.GetProperty("offset").GetInt32());
        using JsonDocument clamped = await GetTargetsAsync(client, sourceId, "zz", 0, 51);
        Assert.Equal(50, clamped.RootElement.GetProperty("limit").GetInt32());
        _ = await CreateStackAsync(client, "Bass Root", "Root Member");
        using JsonDocument beyond = await GetTargetsAsync(client, sourceId, "Bass", 100, 10);
        Assert.Empty(Items(beyond));
        Assert.Equal(1, beyond.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Stack target search hides unknown and foreign source tracks identically")]
    public async Task Stack_target_search_hides_unknown_and_foreign_source_tracks_identically()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient owner, HttpClient other) = await CreateAuthenticatedClientsAsync(host);
        Guid foreignSource = await CreateTrackAsync(other, "Foreign Source");
        (HttpStatusCode Status, JsonElement Body) unknown = await GetJsonAsync(
            owner,
            TargetUrl(Guid.CreateVersion7(), "ab"));
        (HttpStatusCode Status, JsonElement Body) foreign = await GetJsonAsync(
            owner,
            TargetUrl(foreignSource, "ab"));
        AssertError(unknown, HttpStatusCode.NotFound, "track.not_found");
        AssertError(foreign, HttpStatusCode.NotFound, "track.not_found");
        Assert.Equal(
            unknown.Body.GetProperty("message").GetString(),
            foreign.Body.GetProperty("message").GetString());
    }

    [Fact(DisplayName = "Stack target search rejects a known ineligible source")]
    public async Task Stack_target_search_rejects_a_known_ineligible_source()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Member Source");
        Guid rootId = await CreateTrackAsync(client, "Existing Root");
        await MarkOriginalAsync(client, rootId, "Existing Root", 2000);
        await CreateRelationAsync(client, sourceId, rootId, "versionOf");
        AssertError(
            await GetJsonAsync(client, TargetUrl(sourceId, "ab")),
            HttpStatusCode.Conflict,
            "track_stack.source_not_standalone");
    }
}
