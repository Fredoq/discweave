using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportDiscogsProvenanceTests
{
    [Fact(DisplayName = "Desktop import inherited release artists are materialized on matched tracks")]
    public async Task Desktop_import_inherited_release_artists_are_materialized_on_matched_tracks()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[MORE 01, 1993] Robin S - Show Me Love");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Show Me Love.m4a");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "m4a");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Robin S.");
        Guid existingTrackId = await CreateTrackAsync(client, "Show Me Love (StoneBridge Club Mix)");

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid importTrackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayloadWithInheritedMatchedTrack(importTrackId, artistId, existingTrackId));
        using JsonDocument update = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.True(update.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0].GetProperty("inheritReleaseArtistCredits").GetBoolean());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirm = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirm.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());

        using JsonDocument track = await GetJsonAsync(client, $"/api/tracks/{existingTrackId}");
        JsonElement credit = Assert.Single(track.RootElement.GetProperty("credits").EnumerateArray());
        Assert.Equal(artistId, credit.GetProperty("artistId").GetGuid());
        Assert.Equal("mainArtist", credit.GetProperty("role").GetString());

        using JsonDocument search = await GetJsonAsync(client, "/api/search?query=Robin%20S.&type=track&limit=10&offset=0");
        Assert.Contains(search.RootElement.GetProperty("items").EnumerateArray(), item =>
            item.GetProperty("type").GetString() == "track" &&
            item.GetProperty("id").GetGuid() == existingTrackId);

        using JsonDocument export = await GetJsonAsync(client, "/api/exports/json");
        JsonElement exportedCredit = Assert.Single(
            export.RootElement.GetProperty("credits").EnumerateArray(),
            creditElement =>
                creditElement.GetProperty("targetType").GetString() == "track" &&
                creditElement.GetProperty("targetId").GetGuid() == existingTrackId);
        Assert.Equal(artistId, exportedCredit.GetProperty("contributorArtistId").GetGuid());
        Assert.Equal("mainArtist", exportedCredit.GetProperty("role").GetString());
    }

    private static object ReviewedDraftPayloadWithInheritedMatchedTrack(Guid importTrackId, Guid artistId, Guid selectedTrackId)
    {
        return new
        {
            title = "Show Me Love",
            type = "single",
            catalogNumber = "MORE 01",
            labelName = (string?)null,
            releaseDate = "1993-01-01",
            year = 1993,
            isVariousArtists = false,
            notOnLabel = false,
            artistNames = Array.Empty<string>(),
            artistCredits = new object[] { new { artistId, name = "Robin S.", role = "mainArtist" } },
            labels = new object[]
            {
                new { labelId = (Guid?)null, name = "More Disco", catalogNumber = "MORE 01", hasNoCatalogNumber = false }
            },
            selectedArtistIds = Array.Empty<Guid>(),
            genres = new[] { "House" },
            tags = Array.Empty<string>(),
            coverPath = (string?)null,
            externalSources = Array.Empty<object>(),
            tracks = new object[]
            {
                new
                {
                    id = importTrackId,
                    position = (int?)1,
                    disc = (string?)null,
                    side = "A",
                    title = "Show Me Love (StoneBridge Club Mix)",
                    durationSeconds = (int?)463,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId,
                    inheritReleaseArtistCredits = true,
                    isSkipped = false
                }
            }
        };
    }

    private static async Task<Guid> CreateArtistAsync(HttpClient client, string name)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/artists", new { type = "person", name });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateTrackAsync(HttpClient client, string title)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title, genres = Array.Empty<string>(), tags = Array.Empty<string>() });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> GetJsonAsync(HttpClient client, string path)
    {
        using HttpResponseMessage response = await client.GetAsync(path);
        JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        return document;
    }
}
