using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackEndpointContractTests
{
    [Fact(DisplayName = "Track responses expose related digital files as derived collection context")]
    public async Task Track_responses_expose_related_digital_files_as_derived_collection_context()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseWithTrackAsync(client, "Fallen", "Begins");
        Guid trackId = await GetFirstTrackIdAsync(client, releaseId);
        Guid ownedItemId = await CreateOwnedItemAsync(client, releaseId, new { type = "digital" });
        DigitalFileSeed seed = await host.SeedDigitalTrackFileLinkAsync(
            releaseId,
            ownedItemId,
            releaseTrackPosition: 1,
            "/music/fallen/01-begins.flac",
            "flac",
            "ABCDEF0123");

        using HttpResponseMessage getResponse = await client.GetAsync($"/api/tracks/{trackId}");
        using JsonDocument getDocument = await ReadJsonAsync(getResponse);
        using HttpResponseMessage listResponse = await client.GetAsync("/api/tracks?search=Begins&limit=10&offset=0");
        using JsonDocument listDocument = await ReadJsonAsync(listResponse);

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        JsonElement file = Assert.Single(getDocument.RootElement.GetProperty("digitalFiles").EnumerateArray());
        Assert.Equal(seed.LinkId, file.GetProperty("digitalTrackFileLinkId").GetGuid());
        Assert.Equal(seed.LocalAudioFileId, file.GetProperty("localAudioFileId").GetGuid());
        Assert.Equal(ownedItemId, file.GetProperty("digitalOwnedItemId").GetGuid());
        Assert.Equal(releaseId, file.GetProperty("releaseId").GetGuid());
        Assert.Equal("Fallen", file.GetProperty("releaseTitle").GetString());
        Assert.Equal("/music/fallen/01-begins.flac", file.GetProperty("path").GetString());
        Assert.Equal("flac", file.GetProperty("format").GetString());
        Assert.Equal("abcdef0123", file.GetProperty("contentHash").GetString());
        _ = Assert.Single(listDocument.RootElement.GetProperty("items")[0].GetProperty("digitalFiles").EnumerateArray());
    }

    private static async Task<Guid> CreateReleaseWithTrackAsync(HttpClient client, string releaseTitle, string trackTitle)
    {
        Guid artistId = await CreateArtistAsync(client, $"{releaseTitle} Artist");
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/releases",
            new
            {
                title = releaseTitle,
                type = "standalone",
                isVariousArtists = false,
                artistCredits = new object[] { new { artistId, role = "mainArtist" } },
                labels = Array.Empty<object>(),
                notOnLabel = true,
                genres = ElectronicGenres,
                tags = Array.Empty<string>(),
                tracklist = new object[]
                {
                    new { title = trackTitle, position = 1, artistCredits = Array.Empty<object>() }
                },
                ownedCopy = (object?)null
            });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> GetFirstTrackIdAsync(HttpClient client, Guid releaseId)
    {
        using HttpResponseMessage response = await client.GetAsync($"/api/releases/{releaseId}");
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        return document.RootElement.GetProperty("tracklist")[0].GetProperty("trackId").GetGuid();
    }

    private static async Task<Guid> CreateOwnedItemAsync(HttpClient client, Guid releaseId, object medium)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/owned-items",
            new { releaseId, status = "owned", medium });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }
}
