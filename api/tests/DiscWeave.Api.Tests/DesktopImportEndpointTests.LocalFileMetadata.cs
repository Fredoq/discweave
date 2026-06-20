using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    private static readonly string[] RobinArtistNames = ["Robin S."];

    [Fact(DisplayName = "Desktop import confirmation records ALAC local file metadata")]
    public async Task Desktop_import_confirmation_records_alac_local_file_metadata()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "Robin S - Show Me Love");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Show Me Love.m4a");
        await File.WriteAllTextAsync(audioPath, "fake alac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                files = new[]
                {
                    new
                    {
                        filePath = audioPath,
                        relativePath = Path.GetRelativePath(root.Path, audioPath),
                        format = "m4a",
                        sizeBytes = 9,
                        lastModifiedAt = DateTimeOffset.UtcNow,
                        contentHash = "b5beefa535b8ff1daab45f588c6e73dab96b88bdcf87b2b58cbcf1eda4a862e4",
                        audioMetadata = new
                        {
                            title = "Show Me Love",
                            artists = RobinArtistNames,
                            albumTitle = "Show Me Love",
                            albumArtists = RobinArtistNames,
                            catalogNumber = (string?)null,
                            releaseDate = (string?)null,
                            year = (int?)1993,
                            durationSeconds = (int?)532,
                            trackNumber = (int?)1,
                            codec = "ALAC",
                            container = "M4A/mp42/isom",
                            lossless = (bool?)true,
                            bitrateKbps = (int?)842,
                            sampleRateHz = (int?)44100,
                            channels = (int?)2
                        },
                        coverArtifact = (object?)null
                    }
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        JsonElement draft = scanDocument.RootElement.GetProperty("drafts")[0];
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid draftId = draft.GetProperty("id").GetGuid();
        Assert.Equal("alac", draft.GetProperty("tracks")[0].GetProperty("format").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());

        using HttpResponseMessage itemResponse = await client.GetAsync("/api/owned-items?limit=10&offset=0");
        using JsonDocument itemDocument = await ReadJsonAsync(itemResponse);
        JsonElement ownedItem = Assert.Single(itemDocument.RootElement.GetProperty("items").EnumerateArray());
        JsonElement digitalFile = Assert.Single(ownedItem.GetProperty("details").GetProperty("digital").GetProperty("files").EnumerateArray());

        Assert.Equal("alac", digitalFile.GetProperty("format").GetString());
        Assert.Equal("ALAC", digitalFile.GetProperty("codec").GetString());
        Assert.Equal("lossless", digitalFile.GetProperty("quality").GetString());
        Assert.Equal(532, digitalFile.GetProperty("durationSeconds").GetInt32());
        Assert.Equal(842, digitalFile.GetProperty("bitrateKbps").GetInt32());
        Assert.Equal(44100, digitalFile.GetProperty("sampleRateHz").GetInt32());
        Assert.Equal(2, digitalFile.GetProperty("channels").GetInt32());
    }

    [Fact(DisplayName = "Desktop import confirmation leaves ambiguous M4A quality unrecorded")]
    public async Task Desktop_import_confirmation_leaves_ambiguous_m4a_quality_unrecorded()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "Unknown M4A Release");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Unknown Codec.m4a");
        await File.WriteAllTextAsync(audioPath, "fake m4a");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                files = new[]
                {
                    new
                    {
                        filePath = audioPath,
                        relativePath = Path.GetRelativePath(root.Path, audioPath),
                        format = "m4a",
                        sizeBytes = 8,
                        lastModifiedAt = DateTimeOffset.UtcNow,
                        contentHash = "9b6b9c91c4c2fef7c9db2f1fffe6a419a11fd317fd3f89f81221d339abf95121",
                        audioMetadata = (object?)null,
                        coverArtifact = (object?)null
                    }
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        JsonElement draft = scanDocument.RootElement.GetProperty("drafts")[0];
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid draftId = draft.GetProperty("id").GetGuid();
        Assert.Equal("m4a", draft.GetProperty("tracks")[0].GetProperty("format").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());

        using HttpResponseMessage itemResponse = await client.GetAsync("/api/owned-items?limit=10&offset=0");
        using JsonDocument itemDocument = await ReadJsonAsync(itemResponse);
        JsonElement ownedItem = Assert.Single(itemDocument.RootElement.GetProperty("items").EnumerateArray());
        JsonElement digitalFile = Assert.Single(ownedItem.GetProperty("details").GetProperty("digital").GetProperty("files").EnumerateArray());

        Assert.Equal("m4a", digitalFile.GetProperty("format").GetString());
        Assert.Equal(JsonValueKind.Null, digitalFile.GetProperty("quality").ValueKind);
    }
}
