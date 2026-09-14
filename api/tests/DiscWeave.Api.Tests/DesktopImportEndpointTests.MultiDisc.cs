using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Desktop import allows repeated track numbers on different discs")]
    public async Task Desktop_import_allows_repeated_track_numbers_on_different_discs()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "Multi Disc Release");
        string firstDiscDirectory = Path.Combine(releaseDirectory, "CD 1");
        string secondDiscDirectory = Path.Combine(releaseDirectory, "CD 2");
        _ = Directory.CreateDirectory(firstDiscDirectory);
        _ = Directory.CreateDirectory(secondDiscDirectory);
        string firstTrackPath = Path.Combine(firstDiscDirectory, "01 First.flac");
        string secondTrackPath = Path.Combine(secondDiscDirectory, "01 Second.flac");
        await File.WriteAllTextAsync(firstTrackPath, "first track");
        await File.WriteAllTextAsync(secondTrackPath, "second track");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new[]
                {
                    new
                    {
                        filePath = firstTrackPath,
                        relativePath = Path.GetRelativePath(root.Path, firstTrackPath),
                        format = "flac",
                        sizeBytes = 11,
                        lastModifiedAt = DateTimeOffset.UtcNow,
                        contentHash = "1111111111111111111111111111111111111111111111111111111111111111",
                        audioMetadata = TrackMetadata("First", 180),
                        coverArtifact = (object?)null
                    },
                    new
                    {
                        filePath = secondTrackPath,
                        relativePath = Path.GetRelativePath(root.Path, secondTrackPath),
                        format = "flac",
                        sizeBytes = 12,
                        lastModifiedAt = DateTimeOffset.UtcNow,
                        contentHash = "2222222222222222222222222222222222222222222222222222222222222222",
                        audioMetadata = TrackMetadata("Second", 181),
                        coverArtifact = (object?)null
                    }
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        JsonElement draft = Assert.Single(scanDocument.RootElement.GetProperty("drafts").EnumerateArray());
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid draftId = draft.GetProperty("id").GetGuid();
        Assert.Equal(2, draft.GetProperty("tracks").GetArrayLength());
        Assert.Equal("CD 1", draft.GetProperty("tracks")[0].GetProperty("disc").GetString());
        Assert.Equal("CD 2", draft.GetProperty("tracks")[1].GetProperty("disc").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
    }

    private static object TrackMetadata(string title, int durationSeconds)
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
            trackNumber = (int?)1
        };
    }
}
