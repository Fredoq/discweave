using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReleaseTracklistLinkingE2ETests
{
    [Fact(DisplayName = "Release entry update edits canonical metadata on a linked track")]
    public async Task Release_entry_update_edits_canonical_metadata_on_a_linked_track()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "New Order");

        using JsonDocument createDocument = await CreateReleaseAsync(
            client,
            "Blue Monday",
            artistId,
            [
                new
                {
                    title = "Blue Monday",
                    position = 1,
                    durationSeconds = 449,
                    artistCredits = Array.Empty<object>()
                }
            ],
            year: 1983);
        Guid releaseId = createDocument.RootElement.GetProperty("id").GetGuid();
        Guid trackId = createDocument.RootElement.GetProperty("tracklist")[0].GetProperty("trackId").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/releases/{releaseId}",
            ReleasePayload(
                "Blue Monday",
                artistId,
                [
                    new
                    {
                        trackId,
                        title = "Blue Monday 1988",
                        position = 1,
                        durationSeconds = 435,
                        versionYear = 1988,
                        artistCredits = Array.Empty<object>()
                    }
                ],
                year: 1988));
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);
        using HttpResponseMessage trackResponse = await client.GetAsync($"/api/tracks/{trackId}");
        using JsonDocument trackDocument = await ReadJsonAsync(trackResponse);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal("Blue Monday 1988", updateDocument.RootElement.GetProperty("tracklist")[0].GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.OK, trackResponse.StatusCode);
        Assert.Equal("Blue Monday 1988", trackDocument.RootElement.GetProperty("title").GetString());
        Assert.Equal(435, trackDocument.RootElement.GetProperty("durationSeconds").GetInt32());
        Assert.Equal(1988, trackDocument.RootElement.GetProperty("versionYear").GetInt32());
    }
}
