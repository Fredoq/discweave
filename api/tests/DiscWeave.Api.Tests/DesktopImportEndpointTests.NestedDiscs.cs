using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    private static readonly string[] PrydaArtistNames = ["Pryda"];
    private static readonly string[] PrydaAlbumArtistNames = ["Eric Prydz"];

    [Fact(DisplayName = "Desktop import groups titled disc folders with disc-suffixed album tags into one release")]
    public async Task Desktop_import_groups_titled_disc_folders_with_disc_suffixed_album_tags_into_one_release()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "2012", "[5099946319159, 2012-05-21] Eric Prydz Presents Pryda - Pryda");
        List<object> files =
        [
            await NestedDiscFileAsync(root.Path, releaseDirectory, "Disc 01", "01 Miami To Atlanta.m4a", "Eric Prydz Presents Pryda Cd1", 1),
            await NestedDiscFileAsync(root.Path, releaseDirectory, "Disc 01", "02 Aftermath.m4a", "Eric Prydz Presents Pryda Cd1", 2),
            await NestedDiscFileAsync(root.Path, releaseDirectory, "Disc 02", "01 Rakfunk.m4a", "Eric Prydz Presents Pryda Cd2", 1),
            await NestedDiscFileAsync(root.Path, releaseDirectory, "Disc 03 - Retrospective Mix", "01 The End.m4a", "Eric Prydz Presents Pryda Cd3", 1),
            await NestedDiscFileAsync(root.Path, releaseDirectory, "Disc 03 - Retrospective Mix", "12 Mirage.m4a", "Eric Prydz Presents Pryda", 12)
        ];
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new { sourceRoot = root.Path, ignoredFileCount = 0, diagnostics = Array.Empty<object>(), files });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Empty(document.RootElement.GetProperty("looseFileCandidates").EnumerateArray());
        JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Equal("Eric Prydz Presents Pryda", draft.GetProperty("title").GetString());
        Assert.DoesNotContain(
            draft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("message").GetString()!.Contains("did not match", StringComparison.Ordinal));
        Assert.Equal(
            ["Disc 01", "Disc 01", "Disc 02", "Disc 03", "Disc 03"],
            draft.GetProperty("tracks").EnumerateArray().Select(track => track.GetProperty("disc").GetString()));
    }

    [Fact(DisplayName = "Desktop import uses custom disc folder patterns to group nested folders")]
    public async Task Desktop_import_uses_custom_disc_folder_patterns_to_group_nested_folders()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "Box Set");
        object[] files =
        [
            await NestedDiscFileAsync(root.Path, releaseDirectory, "Vinyl 1", "01 First.flac", "Box Set", 1),
            await NestedDiscFileAsync(root.Path, releaseDirectory, "Vinyl 2", "01 Second.flac", "Box Set", 1)
        ];
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        var scanRequest = new { sourceRoot = root.Path, ignoredFileCount = 0, diagnostics = Array.Empty<object>(), files };

        using HttpResponseMessage beforeResponse = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", scanRequest);
        using JsonDocument before = await ReadJsonAsync(beforeResponse);
        using HttpResponseMessage patternResponse = await client.PostAsJsonAsync(
            "/api/settings/import-patterns",
            new { kind = "discFolder", template = "Vinyl {disc}", sortOrder = 5, isActive = true });
        using HttpResponseMessage afterResponse = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", scanRequest);
        using JsonDocument after = await ReadJsonAsync(afterResponse);

        Assert.Equal(2, before.RootElement.GetProperty("drafts").GetArrayLength());
        Assert.Equal(HttpStatusCode.Created, patternResponse.StatusCode);
        JsonElement draft = Assert.Single(after.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Equal(
            ["Vinyl 1", "Vinyl 2"],
            draft.GetProperty("tracks").EnumerateArray().Select(track => track.GetProperty("disc").GetString()));
    }

    private static async Task<object> NestedDiscFileAsync(
        string rootPath,
        string releaseDirectory,
        string discFolder,
        string fileName,
        string albumTitle,
        int trackNumber)
    {
        string discDirectory = Path.Combine(releaseDirectory, discFolder);
        _ = Directory.CreateDirectory(discDirectory);
        string trackPath = Path.Combine(discDirectory, fileName);
        await File.WriteAllTextAsync(trackPath, fileName);
        string extension = Path.GetExtension(fileName).TrimStart('.');
        return new
        {
            filePath = trackPath,
            relativePath = Path.GetRelativePath(rootPath, trackPath),
            format = extension,
            sizeBytes = fileName.Length,
            lastModifiedAt = DateTimeOffset.Parse("2026-09-01T00:00:00Z", System.Globalization.CultureInfo.InvariantCulture),
            contentHash = Convert.ToHexStringLower(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(trackPath))),
            audioMetadata = new
            {
                title = Path.GetFileNameWithoutExtension(fileName)[3..],
                artists = PrydaArtistNames,
                albumTitle,
                albumArtists = PrydaAlbumArtistNames,
                catalogNumber = (string?)null,
                releaseDate = (string?)null,
                year = (int?)2012,
                durationSeconds = (int?)300,
                trackNumber = (int?)trackNumber
            },
            coverArtifact = (object?)null
        };
    }
}
