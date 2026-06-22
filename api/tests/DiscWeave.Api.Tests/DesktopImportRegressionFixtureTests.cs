using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class DesktopImportRegressionFixtureTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public DesktopImportRegressionFixtureTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Regression fixture imports normal compilation and multi-disc release folders")]
    public async Task Regression_fixture_imports_normal_compilation_and_multi_disc_release_folders()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string root = "/fixtures/messy";

        using JsonDocument scan = await PostScanAsync(
            client,
            root,
            files:
            [
                AudioFile(root, "[DW 01, 2026] Fixture Artist - Normal/01 First.flac", "fixture-normal-hash", "First", "Normal", ["Fixture Artist"], ["Fixture Artist"], 1),
                AudioFile(root, "[DW 02, 2026] Various - Compilation/CD 1/01 Alpha.flac", "fixture-alpha-hash", "Alpha", "Compilation", ["Various Artists"], ["Alpha Artist"], 1),
                AudioFile(root, "[DW 02, 2026] Various - Compilation/CD 2/01 Beta.flac", "fixture-beta-hash", "Beta", "Compilation", ["Various Artists"], ["Beta Artist"], 1)
            ]);
        JsonElement[] drafts = [.. scan.RootElement.GetProperty("drafts").EnumerateArray()];
        JsonElement compilation = drafts.Single(draft => draft.GetProperty("title").GetString() == "Compilation");
        string raw = scan.RootElement.GetRawText();

        Assert.Equal(2, scan.RootElement.GetProperty("draftCount").GetInt32());
        Assert.Contains(drafts, draft => draft.GetProperty("title").GetString() == "Normal");
        Assert.True(compilation.GetProperty("isVariousArtists").GetBoolean());
        Assert.Contains(compilation.GetProperty("tracks").EnumerateArray(), track => track.GetProperty("disc").GetString() == "CD 1");
        Assert.Contains(compilation.GetProperty("tracks").EnumerateArray(), track => track.GetProperty("disc").GetString() == "CD 2");
        Assert.DoesNotContain("audioBytes", raw, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("contentBase64", raw, StringComparison.OrdinalIgnoreCase);
    }

    [Fact(DisplayName = "Regression fixture stages root mixed and untagged loose files without catalog rows")]
    public async Task Regression_fixture_stages_root_mixed_and_untagged_loose_files_without_catalog_rows()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string root = "/fixtures/loose";

        using JsonDocument scan = await PostScanAsync(
            client,
            root,
            files:
            [
                AudioFile(root, "Root Loose.flac", "fixture-root-loose-hash", "Root Loose", "Loose Album", ["Loose Artist"], ["Loose Artist"], 1),
                AudioFile(root, "Mixed/01 Album A.flac", "fixture-mixed-a-hash", "Album A", "Album A", ["Mixed Artist"], ["Mixed Artist"], 1),
                AudioFile(root, "Mixed/02 Album B.flac", "fixture-mixed-b-hash", "Album B", "Album B", ["Mixed Artist"], ["Mixed Artist"], 2),
                AudioFile(root, "No Tags/01 Untagged.flac", "fixture-untagged-hash", null, null, [], [], null)
            ]);
        JsonElement[] candidates = [.. scan.RootElement.GetProperty("looseFileCandidates").EnumerateArray()];
        string[] reasons = [.. candidates.Select(candidate => candidate.GetProperty("reason").GetString() ?? string.Empty)];

        Assert.Equal(3, scan.RootElement.GetProperty("looseFileCandidateCount").GetInt32());
        Assert.Contains("root_audio_unclear_release_context", reasons);
        Assert.Equal(2, reasons.Count(reason => reason == "mixed_album_tags"));
        Assert.Contains(scan.RootElement.GetProperty("drafts").EnumerateArray(), draft => draft.GetProperty("title").GetString() == "No Tags");
        Assert.Empty(await host.LocalAudioFilesAsync());
        Assert.Empty(await host.DigitalTrackFileLinksAsync());
    }

    [Fact(DisplayName = "Regression fixture covers names-only missing hashes skipped drafts and moved duplicate files")]
    public async Task Regression_fixture_covers_names_only_missing_hashes_skipped_drafts_and_moved_duplicate_files()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument confirmed = await PostScanAsync(
            client,
            "/fixtures/confirmed",
            [AudioFile("/fixtures/confirmed", "[DW 03, 2026] Fixture Artist - Keep/01 Keep.flac", "fixture-keep-hash", "Keep", "Keep", ["Fixture Artist"], ["Fixture Artist"], 1)]);
        await ConfirmOnlyDraftAsync(client, confirmed);

        using JsonDocument namesOnly = await PostScanAsync(
            client,
            "/fixtures/cloud",
            [AudioFile("/fixtures/cloud", "[DW 04, 2026] Fixture Artist - Cloud/01 Cloud.flac", null, null, null, [], [], null)],
            scanMode: "namesOnly");
        JsonElement cloudTrack = namesOnly.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];
        using JsonDocument skipped = await SkipOnlyDraftAsync(client, namesOnly);
        using JsonDocument moved = await PostScanAsync(
            client,
            "/fixtures/moved",
            [AudioFile("/fixtures/moved", "[DW 03, 2026] Fixture Artist - Keep/01 Keep Renamed.flac", "fixture-keep-hash", "Keep", "Keep", ["Fixture Artist"], ["Fixture Artist"], 1)]);
        JsonElement movedTrack = moved.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];

        Assert.Equal("namesOnly", namesOnly.RootElement.GetProperty("scanMode").GetString());
        Assert.Contains(cloudTrack.GetProperty("issues").EnumerateArray(), issue => issue.GetProperty("code").GetString() == "release_import.content_hash_missing");
        Assert.Equal("completed", skipped.RootElement.GetProperty("status").GetString());
        Assert.NotEqual(JsonValueKind.Null, movedTrack.GetProperty("selectedTrackId").ValueKind);
        Assert.Equal("contentHash", movedTrack.GetProperty("moveHint").GetProperty("matchKind").GetString());
        Assert.Contains("/fixtures/confirmed/", movedTrack.GetProperty("moveHint").GetProperty("previousPath").GetString());
    }

    private static async Task<JsonDocument> PostScanAsync(HttpClient client, string rootPath, object[] files, string scanMode = "full")
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new { sourceRoot = rootPath, scanMode, ignoredFileCount = 0, diagnostics = Array.Empty<object>(), files });
        JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document;
    }

    private static object AudioFile(string rootPath, string relativePath, string? hash, string? title, string? album, string[] albumArtists, string[] artists, int? trackNumber)
    {
        return new
        {
            filePath = $"{rootPath}/{relativePath}",
            relativePath,
            format = "flac",
            sizeBytes = 9,
            lastModifiedAt = DateTimeOffset.Parse("2026-06-01T12:00:00Z", CultureInfo.InvariantCulture),
            contentHash = hash,
            audioMetadata = title is null && album is null && albumArtists.Length == 0 && artists.Length == 0
                ? null
                : new
                {
                    title,
                    artists,
                    albumTitle = album,
                    albumArtists,
                    catalogNumber = (string?)null,
                    releaseDate = "2026",
                    year = (int?)2026,
                    durationSeconds = (int?)null,
                    trackNumber
                },
            coverArtifact = (object?)null
        };
    }

    private static async Task ConfirmOnlyDraftAsync(HttpClient client, JsonDocument scan)
    {
        using HttpResponseMessage response = await client.PostAsync($"/api/imports/{SessionId(scan)}/drafts/{DraftId(scan)}/confirm", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<JsonDocument> SkipOnlyDraftAsync(HttpClient client, JsonDocument scan)
    {
        using HttpResponseMessage response = await client.PostAsync($"/api/imports/{SessionId(scan)}/drafts/{DraftId(scan)}/skip", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadJsonAsync(response);
    }

    private static Guid SessionId(JsonDocument document) => document.RootElement.GetProperty("id").GetGuid();

    private static Guid DraftId(JsonDocument document) => document.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
    }
}
