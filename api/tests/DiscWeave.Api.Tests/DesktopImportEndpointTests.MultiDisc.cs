using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Desktop import preserves multi disc order and reuses the release on reimport")]
    public async Task Desktop_import_preserves_multi_disc_order_and_reuses_the_release_on_reimport()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "Multi Disc Release");
        string[] titles = ["First", "Second", "Third", "Fourth"];
        List<object> files = [];
        for (int index = 0; index < titles.Length; index++)
        {
            int disc = (index / 2) + 1;
            int position = (index % 2) + 1;
            string discDirectory = Path.Combine(releaseDirectory, $"CD {disc}");
            _ = Directory.CreateDirectory(discDirectory);
            string trackPath = Path.Combine(discDirectory, $"{position:00} {titles[index]}.flac");
            await File.WriteAllTextAsync(trackPath, titles[index]);
            files.Add(new
            {
                filePath = trackPath,
                relativePath = Path.GetRelativePath(root.Path, trackPath),
                format = "flac",
                sizeBytes = titles[index].Length,
                lastModifiedAt = DateTimeOffset.Parse("2026-09-01T00:00:00Z", System.Globalization.CultureInfo.InvariantCulture),
                contentHash = new string((char)('1' + index), 64),
                audioMetadata = TrackMetadata(titles[index], 180 + index, position),
                coverArtifact = (object?)null
            });
        }
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        var scanRequest = new
        {
            sourceRoot = root.Path,
            ignoredFileCount = 0,
            diagnostics = Array.Empty<object>(),
            files
        };
        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", scanRequest);
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        JsonElement draft = Assert.Single(scanDocument.RootElement.GetProperty("drafts").EnumerateArray());
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid draftId = draft.GetProperty("id").GetGuid();
        Assert.Equal(4, draft.GetProperty("tracks").GetArrayLength());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());

        using JsonDocument releases = await ReadJsonAsync(await client.GetAsync("/api/releases?limit=10&offset=0"));
        Guid releaseId = Assert.Single(releases.RootElement.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid();
        using JsonDocument release = await ReadJsonAsync(await client.GetAsync($"/api/releases/{releaseId}"));
        Assert.Equal(titles, release.RootElement.GetProperty("tracklist").EnumerateArray().Select(track => track.GetProperty("title").GetString()));
        using JsonDocument export = await ReadJsonAsync(await client.GetAsync("/api/exports/json"));
        JsonElement exportedRelease = Assert.Single(export.RootElement.GetProperty("releases").EnumerateArray());
        Assert.Equal(titles, exportedRelease.GetProperty("tracklist").EnumerateArray().Select(track => track.GetProperty("title").GetString()));

        using HttpResponseMessage reimportResponse = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", scanRequest);
        using JsonDocument reimport = await ReadJsonAsync(reimportResponse);
        Assert.Equal(HttpStatusCode.Created, reimportResponse.StatusCode);
        Guid reimportSessionId = reimport.RootElement.GetProperty("id").GetGuid();
        JsonElement reimportDraft = Assert.Single(reimport.RootElement.GetProperty("drafts").EnumerateArray());
        Guid reimportDraftId = reimportDraft.GetProperty("id").GetGuid();
        Assert.All(reimportDraft.GetProperty("tracks").EnumerateArray(), track => Assert.NotEqual(JsonValueKind.Null, track.GetProperty("selectedTrackId").ValueKind));

        using HttpResponseMessage preflightResponse = await client.PostAsJsonAsync($"/api/imports/{reimportSessionId}/drafts/{reimportDraftId}/confirmation-preflight", reimportDraft);
        Assert.Equal(HttpStatusCode.OK, preflightResponse.StatusCode);
        using JsonDocument preflight = await ReadJsonAsync(preflightResponse);
        Assert.Equal("exactDuplicate", preflight.RootElement.GetProperty("outcome").GetString());
        Assert.Equal(1, preflight.RootElement.GetProperty("summary").GetProperty("reusedReleases").GetInt32());

        using HttpResponseMessage reimportConfirmResponse = await client.PostAsync($"/api/imports/{reimportSessionId}/drafts/{reimportDraftId}/confirm", null);
        Assert.Equal(HttpStatusCode.OK, reimportConfirmResponse.StatusCode);
        using JsonDocument finalReleases = await ReadJsonAsync(await client.GetAsync("/api/releases?limit=10&offset=0"));
        Assert.Equal(releaseId, Assert.Single(finalReleases.RootElement.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
    }

    private static object TrackMetadata(string title, int durationSeconds, int position)
    {
        return new
        {
            title,
            artists = MultiDiscArtistNames,
            albumTitle = "Multi Disc Release",
            albumArtists = MultiDiscArtistNames,
            catalogNumber = (string?)null,
            releaseDate = (string?)null,
            year = (int?)1995,
            durationSeconds = (int?)durationSeconds,
            trackNumber = (int?)position
        };
    }
}
