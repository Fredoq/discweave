using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class PlaylistEndpointTests
{
    [Fact(DisplayName = "A create retry after an unobserved response returns the same playlist and preserves repeated entries")]
    public async Task A_create_retry_after_an_unobserved_response_returns_the_same_playlist_and_preserves_repeated_entries()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid track = await CreateTrackAsync(client, "Replay track");
        var requestId = Guid.NewGuid();
        var request = new
        {
            clientRequestId = requestId,
            name = "Replay list",
            type = "manual",
            entries = new[] { new { kind = "track", id = track }, new { kind = "track", id = track } }
        };
        using HttpResponseMessage unobserved = await client.PostAsJsonAsync("/api/playlists", request);
        Assert.Equal(HttpStatusCode.Created, unobserved.StatusCode);
        using HttpResponseMessage retry = await client.PostAsJsonAsync("/api/playlists", request);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        using JsonDocument body = await ReadJsonAsync(retry);
        Assert.Equal(requestId, body.RootElement.GetProperty("id").GetGuid());
        Assert.Equal(2, body.RootElement.GetProperty("entries").GetArrayLength());
        using HttpResponseMessage list = await client.GetAsync("/api/playlists");
        using JsonDocument listed = await ReadJsonAsync(list);
        Assert.Equal(1, listed.RootElement.GetProperty("total").GetInt32());
        using HttpResponseMessage changed = await client.PostAsJsonAsync("/api/playlists",
            new { clientRequestId = requestId, name = "Different payload", type = "manual", request.entries });
        Assert.Equal(HttpStatusCode.Conflict, changed.StatusCode);
        using HttpResponseMessage edited = await client.PutAsJsonAsync($"/api/playlists/{requestId}",
            new { name = "Ordinary edit", type = "manual", request.entries });
        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        using HttpResponseMessage staleRetry = await client.PostAsJsonAsync("/api/playlists", request);
        Assert.Equal(HttpStatusCode.Conflict, staleRetry.StatusCode);
    }

    [Fact(DisplayName = "A create replay never returns another collection's playlist")]
    public async Task A_create_replay_never_returns_another_collections_playlist()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient first, HttpClient second) = await CreateAuthenticatedClientsAsync(host);
        var requestId = Guid.NewGuid();
        var request = new { clientRequestId = requestId, name = "Private playlist", type = "manual", entries = Array.Empty<object>() };
        using HttpResponseMessage created = await first.PostAsJsonAsync("/api/playlists", request);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        using HttpResponseMessage foreign = await second.PostAsJsonAsync("/api/playlists",
            new { clientRequestId = requestId, name = "Second collection playlist", type = "manual", entries = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.Created, foreign.StatusCode);
        Assert.DoesNotContain("Private playlist", await foreign.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        using HttpResponseMessage missing = await second.GetAsync($"/api/playlists/{requestId}");
        Assert.Equal(HttpStatusCode.OK, missing.StatusCode);
        Assert.DoesNotContain("Private playlist", await missing.Content.ReadAsStringAsync(), StringComparison.Ordinal);
    }

    [Fact(DisplayName = "Concurrent creates with the same request identity persist one playlist")]
    public async Task Concurrent_creates_with_the_same_request_identity_persist_one_playlist()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        var requestId = Guid.NewGuid();
        var request = new { clientRequestId = requestId, name = "Concurrent playlist", type = "manual", entries = Array.Empty<object>() };
        HttpResponseMessage[] responses = await Task.WhenAll(
            client.PostAsJsonAsync("/api/playlists", request), client.PostAsJsonAsync("/api/playlists", request));
        try
        {
            foreach (HttpResponseMessage response in responses)
            {
                if (response.StatusCode == HttpStatusCode.InternalServerError)
                {
                    Assert.Fail(await response.Content.ReadAsStringAsync());
                }
            }
            _ = Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
            _ = Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
        }
        finally
        {
            foreach (HttpResponseMessage response in responses)
            {
                response.Dispose();
            }
        }
        using HttpResponseMessage list = await client.GetAsync("/api/playlists");
        using JsonDocument body = await ReadJsonAsync(list);
        Assert.Equal(1, body.RootElement.GetProperty("total").GetInt32());
    }
}
