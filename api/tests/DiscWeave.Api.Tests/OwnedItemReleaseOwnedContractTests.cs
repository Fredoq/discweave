using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class OwnedItemReleaseOwnedContractTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public OwnedItemReleaseOwnedContractTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Owned item response exposes release-owned digital file coverage")]
    public async Task Owned_item_response_exposes_release_owned_digital_file_coverage()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseWithTwoTracksAsync(client);
        Guid ownedItemId = await CreateOwnedItemAsync(client, releaseId, new { type = "digital" });
        DigitalFileSeed seed = await host.SeedDigitalTrackFileLinkAsync(
            releaseId,
            ownedItemId,
            releaseTrackPosition: 1,
            "/music/fallen/01-begins.flac",
            "flac",
            "ABCDEF0123");

        using JsonDocument document = await GetJsonAsync(client, $"/api/owned-items/{ownedItemId}", HttpStatusCode.OK);
        JsonElement root = document.RootElement;

        Assert.False(root.TryGetProperty("targetType", out _));
        Assert.False(root.TryGetProperty("targetId", out _));
        Assert.False(root.TryGetProperty("target", out _));
        Assert.Equal(releaseId, root.GetProperty("releaseId").GetGuid());
        Assert.Equal("Fallen", root.GetProperty("release").GetProperty("title").GetString());
        Assert.Equal("digital", root.GetProperty("medium").GetProperty("type").GetString());
        Assert.False(root.GetProperty("medium").TryGetProperty("path", out _));
        Assert.False(root.GetProperty("medium").TryGetProperty("format", out _));

        JsonElement digital = root.GetProperty("details").GetProperty("digital");
        Assert.Equal(2, digital.GetProperty("releaseTrackCount").GetInt32());
        Assert.Equal(1, digital.GetProperty("linkedFileCount").GetInt32());
        Assert.Equal(1, digital.GetProperty("missingFileCount").GetInt32());
        JsonElement file = Assert.Single(digital.GetProperty("files").EnumerateArray());
        Assert.Equal(seed.LinkId, file.GetProperty("digitalTrackFileLinkId").GetGuid());
        Assert.Equal(seed.ReleaseTrackId, file.GetProperty("releaseTrackId").GetGuid());
        Assert.Equal(seed.LocalAudioFileId, file.GetProperty("localAudioFileId").GetGuid());
        Assert.Equal("/music/fallen/01-begins.flac", file.GetProperty("path").GetString());
        Assert.Equal("flac", file.GetProperty("format").GetString());
        Assert.Equal("abcdef0123", file.GetProperty("contentHash").GetString());
    }

    [Fact(DisplayName = "Owned item response exposes physical details separately from digital coverage")]
    public async Task Owned_item_response_exposes_physical_details_separately_from_digital_coverage()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client, "Physical Release");
        Guid ownedItemId = await CreateOwnedItemAsync(
            client,
            releaseId,
            new { type = "vinyl", description = "12-inch vinyl" },
            condition: "veryGood",
            storageLocation: "Shelf A3");

        using JsonDocument document = await GetJsonAsync(client, $"/api/owned-items/{ownedItemId}", HttpStatusCode.OK);
        JsonElement details = document.RootElement.GetProperty("details");

        Assert.Equal(JsonValueKind.Null, details.GetProperty("digital").ValueKind);
        Assert.Equal("veryGood", details.GetProperty("vinyl").GetProperty("condition").GetString());
        Assert.Equal("Shelf A3", details.GetProperty("vinyl").GetProperty("storageLocation").GetString());
        Assert.Equal("12-inch vinyl", details.GetProperty("vinyl").GetProperty("formatDescription").GetString());
    }

    private static async Task<Guid> CreateReleaseAsync(HttpClient client, string title)
    {
        Guid artistId = await CreateArtistAsync(client, "Contract Artist");
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/releases",
                new
                {
                    title,
                    type = "standalone",
                    isVariousArtists = false,
                    notOnLabel = true,
                    artistCredits = new object[] { new { artistId, role = "mainArtist" } },
                    tracklist = Array.Empty<object>(),
                    genres = Array.Empty<string>(),
                    tags = Array.Empty<string>()
                }),
            HttpStatusCode.Created);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateReleaseWithTwoTracksAsync(HttpClient client)
    {
        Guid artistId = await CreateArtistAsync(client, "Fallen Artist");
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/releases",
                new
                {
                    title = "Fallen",
                    type = "standalone",
                    isVariousArtists = false,
                    notOnLabel = true,
                    artistCredits = new object[] { new { artistId, role = "mainArtist" } },
                    genres = Array.Empty<string>(),
                    tags = Array.Empty<string>(),
                    tracklist = new object[]
                    {
                        new { title = "Begins", position = 1, artistCredits = Array.Empty<object>() },
                        new { title = "Ends", position = 2, artistCredits = Array.Empty<object>() }
                    }
                }),
            HttpStatusCode.Created);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateArtistAsync(HttpClient client, string name)
    {
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync("/api/artists", new { type = "person", name }),
            HttpStatusCode.Created);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateOwnedItemAsync(
        HttpClient client,
        Guid releaseId,
        object medium,
        string status = "owned",
        string? condition = null,
        string? storageLocation = null)
    {
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync("/api/owned-items", new { releaseId, status, medium, condition, storageLocation }),
            HttpStatusCode.Created);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> GetJsonAsync(HttpClient client, string path, HttpStatusCode expectedStatus)
    {
        using HttpResponseMessage response = await client.GetAsync(path);
        return await ReadExpectedJsonAsync(response, expectedStatus);
    }

    private static async Task<JsonDocument> SendJsonAsync(Task<HttpResponseMessage> request, HttpStatusCode expectedStatus)
    {
        using HttpResponseMessage response = await request;
        return await ReadExpectedJsonAsync(response, expectedStatus);
    }

    private static async Task<JsonDocument> ReadExpectedJsonAsync(HttpResponseMessage response, HttpStatusCode expectedStatus)
    {
        string content = await response.Content.ReadAsStringAsync();
        Assert.True(
            response.StatusCode == expectedStatus,
            $"Expected {expectedStatus}, got {response.StatusCode}. Body: {content}");
        return JsonDocument.Parse(content);
    }
}
