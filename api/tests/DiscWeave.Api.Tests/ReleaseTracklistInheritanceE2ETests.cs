using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReleaseTracklistLinkingE2ETests
{
    [Fact(DisplayName = "Release entry inherited main artists are added to linked existing tracks")]
    public async Task Release_entry_inherited_main_artists_are_added_to_linked_existing_tracks()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Robin S.");
        Guid trackId = await CreateTrackAsync(client, "Show Me Love (StoneBridge Club Mix)");

        using JsonDocument releaseDocument = await CreateReleaseAsync(
            client,
            "Show Me Love",
            artistId,
            [
                new
                {
                    trackId,
                    position = 1,
                    inheritReleaseArtistCredits = true
                }
            ],
            type: "single",
            year: 1993);

        Assert.Equal(trackId, releaseDocument.RootElement.GetProperty("tracklist")[0].GetProperty("trackId").GetGuid());

        using HttpResponseMessage trackResponse = await client.GetAsync($"/api/tracks/{trackId}");
        using JsonDocument trackDocument = await ReadJsonAsync(trackResponse);

        Assert.Equal(HttpStatusCode.OK, trackResponse.StatusCode);
        JsonElement credit = Assert.Single(trackDocument.RootElement.GetProperty("credits").EnumerateArray());
        Assert.Equal(artistId, credit.GetProperty("artistId").GetGuid());
        Assert.Equal("mainArtist", credit.GetProperty("role").GetString());
    }

    private static async Task<Guid> CreateTrackAsync(
        HttpClient client,
        string title,
        CancellationToken cancellationToken = default)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title, genres = Array.Empty<string>(), tags = Array.Empty<string>() },
            cancellationToken);
        using JsonDocument document = await ReadJsonAsync(response, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }
}
