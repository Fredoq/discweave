using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class ReleaseTracklistValidationE2ETests : IClassFixture<SqliteFixture>
{
    private static readonly string[] ElectronicGenres = ["Electronic"];
    private readonly SqliteFixture _sqlite;

    public ReleaseTracklistValidationE2ETests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Release entry create rejects duplicate existing tracks in one tracklist")]
    public async Task Release_entry_create_rejects_duplicate_existing_tracks_in_one_tracklist()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Autechre");
        Guid existingTrackId = await CreateSourceTrackAsync(client, artistId, "Dael");

        using HttpResponseMessage duplicateResponse = await client.PostAsJsonAsync(
            "/api/releases",
            ReleasePayload(
                "Duplicate Tracklist",
                artistId,
                [
                    new { trackId = existingTrackId, position = 1 },
                    new { trackId = existingTrackId, position = 2 }
                ],
                type: "standalone",
                year: 1996));
        using JsonDocument duplicateDocument = await ReadJsonAsync(duplicateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
        Assert.Equal("release_track.track_duplicate", duplicateDocument.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Release entry create accepts canonical track fields with existing track id")]
    public async Task Release_entry_create_accepts_canonical_track_fields_with_existing_track_id()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Fred again..");
        Guid existingTrackId = await CreateSourceTrackAsync(client, artistId, "Leavemealone");

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/releases",
            ReleasePayload(
                "Linked Existing Track Shape",
                artistId,
                [
                    new
                    {
                        trackId = existingTrackId,
                        title = "Leavemealone (Edit)",
                        position = 1,
                        durationSeconds = 180,
                        versionYear = 2025,
                        artistCredits = new object[] { new { artistId, role = "mainArtist" } }
                    }
                ],
                type: "standalone",
                year: 2025));
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        using HttpResponseMessage trackResponse = await client.GetAsync($"/api/tracks/{existingTrackId}");
        using JsonDocument trackDocument = await ReadJsonAsync(trackResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal("Leavemealone (Edit)", createDocument.RootElement.GetProperty("tracklist")[0].GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.OK, trackResponse.StatusCode);
        Assert.Equal("Leavemealone (Edit)", trackDocument.RootElement.GetProperty("title").GetString());
        Assert.Equal(180, trackDocument.RootElement.GetProperty("durationSeconds").GetInt32());
        Assert.Equal(2025, trackDocument.RootElement.GetProperty("versionYear").GetInt32());
    }

    [Fact(DisplayName = "Release entry create accepts duplicate track numbers across discs")]
    public async Task Release_entry_create_accepts_duplicate_track_numbers_across_discs()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Autechre");

        using HttpResponseMessage duplicateResponse = await client.PostAsJsonAsync(
            "/api/releases",
            ReleasePayload(
                "Duplicate Global Positions",
                artistId,
                [
                    new { title = "Second Disc Track", position = 1, disc = "CD 2", side = (string?)null },
                    new { title = "First Disc Track", position = 1, disc = "CD 1", side = (string?)null }
                ],
                type: "album",
                year: 1995));
        using JsonDocument document = await ReadJsonAsync(duplicateResponse);

        Assert.Equal(HttpStatusCode.Created, duplicateResponse.StatusCode);
        Assert.Equal(2, document.RootElement.GetProperty("tracklist").GetArrayLength());

        Guid releaseId = document.RootElement.GetProperty("id").GetGuid();
        using JsonDocument releaseDocument = await ReadJsonAsync(await client.GetAsync($"/api/releases/{releaseId}"));
        Assert.Equal("CD 1", releaseDocument.RootElement.GetProperty("tracklist")[0].GetProperty("disc").GetString());
        Assert.Equal("CD 2", releaseDocument.RootElement.GetProperty("tracklist")[1].GetProperty("disc").GetString());

        using JsonDocument exportDocument = await ReadJsonAsync(await client.GetAsync("/api/exports/json"));
        JsonElement exportedRelease = exportDocument.RootElement.GetProperty("releases").EnumerateArray()
            .Single(release => release.GetProperty("id").GetGuid() == releaseId);
        Assert.Equal("CD 1", exportedRelease.GetProperty("tracklist")[0].GetProperty("disc").GetString());
        Assert.Equal("CD 2", exportedRelease.GetProperty("tracklist")[1].GetProperty("disc").GetString());
    }

    [Fact(DisplayName = "Release entry create rejects duplicate positions on one disc")]
    public async Task Release_entry_create_rejects_duplicate_positions_on_one_disc()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Autechre");

        using HttpResponseMessage duplicateResponse = await client.PostAsJsonAsync(
            "/api/releases",
            ReleasePayload(
                "Duplicate Positions On One Disc",
                artistId,
                [
                    new { title = "First Track", position = 1, disc = "CD 1", side = "A" },
                    new { title = "Second Track", position = 1, disc = "CD 1", side = "A" }
                ],
                type: "album",
                year: 1995));
        using JsonDocument duplicateDocument = await ReadJsonAsync(duplicateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, duplicateResponse.StatusCode);
        Assert.Equal("release_track.position_duplicate", duplicateDocument.RootElement.GetProperty("code").GetString());
    }

    private static async Task<Guid> CreateSourceTrackAsync(
        HttpClient client,
        Guid artistId,
        string title,
        CancellationToken cancellationToken = default)
    {
        using JsonDocument sourceDocument = await CreateReleaseAsync(
            client,
            $"Source {title}",
            artistId,
            [
                new
                {
                    title,
                    position = 1,
                    durationSeconds = 222,
                    artistCredits = Array.Empty<object>()
                }
            ],
            cancellationToken);

        return sourceDocument.RootElement.GetProperty("tracklist")[0].GetProperty("trackId").GetGuid();
    }

    private static async Task<JsonDocument> CreateReleaseAsync(
        HttpClient client,
        string title,
        Guid artistId,
        object[] tracklist,
        CancellationToken cancellationToken = default)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/releases",
            ReleasePayload(title, artistId, tracklist),
            cancellationToken);
        JsonDocument document = await ReadJsonAsync(response, cancellationToken);
        Assert.True(response.StatusCode == HttpStatusCode.Created, document.RootElement.ToString());

        return document;
    }

    private static object ReleasePayload(
        string title,
        Guid artistId,
        object[]? tracklist,
        string type = "album",
        int year = 2024)
    {
        return new
        {
            title,
            type,
            isVariousArtists = false,
            artistCredits = new object[] { new { artistId, role = "mainArtist" } },
            labels = Array.Empty<object>(),
            notOnLabel = true,
            year,
            genres = ElectronicGenres,
            tags = Array.Empty<string>(),
            tracklist,
            ownedCopy = (object?)null
        };
    }

    private static async Task<Guid> CreateArtistAsync(
        HttpClient client,
        string name,
        CancellationToken cancellationToken = default)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new { type = "person", name },
            cancellationToken);
        using JsonDocument document = await ReadJsonAsync(response, cancellationToken);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> ReadJsonAsync(
        HttpResponseMessage response,
        CancellationToken cancellationToken = default)
    {
        string content = await response.Content.ReadAsStringAsync(cancellationToken);

        try
        {
            return JsonDocument.Parse(content);
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException($"Response was not JSON. Status: {response.StatusCode}. Body: {content}", exception);
        }
    }
}
