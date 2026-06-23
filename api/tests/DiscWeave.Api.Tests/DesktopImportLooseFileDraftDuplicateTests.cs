using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Loose draft creation preselects duplicate tracks by content hash")]
    public async Task Loose_draft_creation_preselects_duplicate_tracks_by_content_hash()
    {
        using var existingRoot = TempImportRoot.Create();
        string existingDirectory = Path.Combine(existingRoot.Path, "[DW 01, 2026] Loose Artist - Loose Album");
        _ = Directory.CreateDirectory(existingDirectory);
        string existingPath = Path.Combine(existingDirectory, "01 Root Single.flac");
        await File.WriteAllTextAsync(existingPath, "fake flac");
        using var looseRoot = TempImportRoot.Create();
        string loosePath = Path.Combine(looseRoot.Path, "Root Single Copy.flac");
        await File.WriteAllTextAsync(loosePath, "fake flac copy");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument existingScan = await PostReleaseScanAsync(
            client,
            existingRoot.Path,
            existingPath,
            "loose-duplicate-hash",
            "Root Single",
            "Loose Album",
            ["Loose Artist"],
            1);
        await ConfirmOnlyDraftAsync(client, existingScan);
        Guid existingTrackId = await SingleTrackIdAsync(client, "Root Single");
        using JsonDocument looseScan = await PostLooseScanAsync(
            client,
            looseRoot.Path,
            LooseAudioFile(
                looseRoot.Path,
                loosePath,
                "loose-duplicate-hash",
                title: "Root Single",
                artists: ["Loose Artist"]));
        Guid sessionId = looseScan.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(looseScan.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds = new[] { candidateId } });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement track = document.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];
        Assert.Equal(existingTrackId, track.GetProperty("selectedTrackId").GetGuid());
        Assert.Contains(
            track.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
    }

    private static async Task<JsonDocument> PostReleaseScanAsync(
        HttpClient client,
        string rootPath,
        string audioPath,
        string contentHash,
        string title,
        string albumTitle,
        string[] albumArtists,
        int trackNumber)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = rootPath,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new[]
                {
                    new
                    {
                        filePath = audioPath,
                        relativePath = Path.GetRelativePath(rootPath, audioPath),
                        format = "flac",
                        contentHash,
                        sizeBytes = 9,
                        lastModifiedAt = DateTimeOffset.UtcNow,
                        audioMetadata = new
                        {
                            title,
                            artists = albumArtists,
                            albumTitle,
                            albumArtists,
                            catalogNumber = (string?)null,
                            releaseDate = "2026",
                            year = (int?)2026,
                            durationSeconds = 123,
                            trackNumber,
                            codec = "FLAC",
                            container = "flac",
                            lossless = true,
                            bitrateKbps = 900,
                            sampleRateHz = 44100,
                            channels = 2
                        },
                        coverArtifact = (object?)null
                    }
                }
            });
        JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document;
    }

    private static async Task ConfirmOnlyDraftAsync(HttpClient client, JsonDocument scanDocument)
    {
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scanDocument.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        using HttpResponseMessage response = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<Guid> SingleTrackIdAsync(HttpClient client, string search)
    {
        using HttpResponseMessage response = await client.GetAsync($"/api/tracks?search={Uri.EscapeDataString(search)}&limit=10&offset=0");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, document.RootElement.GetProperty("total").GetInt32());
        return document.RootElement.GetProperty("items")[0].GetProperty("id").GetGuid();
    }
}
