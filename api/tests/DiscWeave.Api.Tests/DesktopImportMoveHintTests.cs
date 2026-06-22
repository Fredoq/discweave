using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class DesktopImportMoveHintTests : IClassFixture<SqliteFixture>
{
    private const string StableHash = "1111111111111111111111111111111111111111111111111111111111111111";
    private const string AlternateHash = "2222222222222222222222222222222222222222222222222222222222222222";
    private static readonly DateTimeOffset StableModifiedAt = DateTimeOffset.Parse("2026-06-01T12:00:00Z", CultureInfo.InvariantCulture);
    private readonly SqliteFixture _sqlite;

    public DesktopImportMoveHintTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Rescan shows a high-confidence moved file hint for same hash and new path")]
    public async Task Rescan_shows_high_confidence_moved_file_hint_for_same_hash_and_new_path()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string oldPath = "/music/source/[DW 01, 2026] Archive - Moved/01 Signal.flac";
        string newPath = "/music/rescan/[DW 01, 2026] Archive - Moved/01 Signal (renamed).flac";
        await ConfirmOnlyDraftAsync(client, await PostScanAsync(
            client,
            "/music/source",
            AudioFile("/music/source", oldPath, StableHash)));

        using JsonDocument rescan = await PostScanAsync(
            client,
            "/music/rescan",
            AudioFile("/music/rescan", newPath, StableHash));

        JsonElement hint = rescan.RootElement.GetProperty("drafts")[0]
            .GetProperty("tracks")[0]
            .GetProperty("moveHint");
        Assert.Equal(oldPath, hint.GetProperty("previousPath").GetString());
        Assert.Equal("contentHash", hint.GetProperty("matchKind").GetString());
        Assert.Equal("high", hint.GetProperty("confidence").GetString());
    }

    [Fact(DisplayName = "Rescan keeps same-hash moved hints ambiguous when multiple previous paths match")]
    public async Task Rescan_keeps_same_hash_moved_hints_ambiguous_when_multiple_previous_paths_match()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        await ConfirmOnlyDraftAsync(client, await PostScanAsync(
            client,
            "/music/source-a",
            AudioFile("/music/source-a", "/music/source-a/[DW 01, 2026] Archive - A/01 Signal.flac", StableHash)));
        await ConfirmOnlyDraftAsync(client, await PostScanAsync(
            client,
            "/music/source-b",
            AudioFile("/music/source-b", "/music/source-b/[DW 02, 2026] Archive - B/01 Signal.flac", StableHash)));

        using JsonDocument rescan = await PostScanAsync(
            client,
            "/music/rescan",
            AudioFile("/music/rescan", "/music/rescan/[DW 03, 2026] Archive - C/01 Signal.flac", StableHash));

        JsonElement hint = rescan.RootElement.GetProperty("drafts")[0]
            .GetProperty("tracks")[0]
            .GetProperty("moveHint");
        Assert.Equal(JsonValueKind.Null, hint.GetProperty("previousPath").ValueKind);
        Assert.Equal("contentHash", hint.GetProperty("matchKind").GetString());
        Assert.Equal("ambiguous", hint.GetProperty("confidence").GetString());
    }

    [Fact(DisplayName = "Rescan shows a low-confidence moved file hint from unique size and mtime when hash is missing")]
    public async Task Rescan_shows_low_confidence_moved_file_hint_from_unique_size_and_mtime_when_hash_is_missing()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string oldPath = "/music/source/[DW 01, 2026] Archive - No Hash/01 Untagged.flac";
        string newPath = "/music/rescan/[DW 01, 2026] Archive - No Hash/01 Untagged renamed.flac";
        await ConfirmOnlyDraftAsync(client, await PostScanAsync(
            client,
            "/music/source",
            AudioFile("/music/source", oldPath, null, sizeBytes: 42, lastModifiedAt: StableModifiedAt)));

        using JsonDocument rescan = await PostScanAsync(
            client,
            "/music/rescan",
            AudioFile("/music/rescan", newPath, null, sizeBytes: 42, lastModifiedAt: StableModifiedAt));

        JsonElement hint = rescan.RootElement.GetProperty("drafts")[0]
            .GetProperty("tracks")[0]
            .GetProperty("moveHint");
        Assert.Equal(oldPath, hint.GetProperty("previousPath").GetString());
        Assert.Equal("sizeMtime", hint.GetProperty("matchKind").GetString());
        Assert.Equal("low", hint.GetProperty("confidence").GetString());
    }

    [Fact(DisplayName = "Moved file hints are scoped to the authenticated collection")]
    public async Task Moved_file_hints_are_scoped_to_the_authenticated_collection()
    {
        await using ApiTestHost firstHost = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient firstClient = await firstHost.CreateAuthenticatedClientAsync();
        await ConfirmOnlyDraftAsync(firstClient, await PostScanAsync(
            firstClient,
            "/music/other-collection",
            AudioFile("/music/other-collection", "/music/other-collection/[DW 01, 2026] Archive - Private/01 Signal.flac", AlternateHash)));

        await using ApiTestHost secondHost = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient secondClient = await secondHost.CreateAuthenticatedClientAsync();
        using JsonDocument rescan = await PostScanAsync(
            secondClient,
            "/music/current-collection",
            AudioFile("/music/current-collection", "/music/current-collection/[DW 01, 2026] Archive - Current/01 Signal.flac", AlternateHash));

        JsonElement track = rescan.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];
        Assert.Equal(JsonValueKind.Null, track.GetProperty("moveHint").ValueKind);
    }

    private static object AudioFile(
        string rootPath,
        string filePath,
        string? contentHash,
        long sizeBytes = 9,
        DateTimeOffset? lastModifiedAt = null)
    {
        string fileName = Path.GetFileNameWithoutExtension(filePath);
        int? trackNumber = int.TryParse(fileName.Split(' ', 2)[0], out int parsedTrackNumber)
            ? parsedTrackNumber
            : null;

        return new
        {
            filePath,
            relativePath = Path.GetRelativePath(rootPath, filePath),
            format = "flac",
            sizeBytes,
            lastModifiedAt = lastModifiedAt ?? StableModifiedAt,
            contentHash,
            audioMetadata = new
            {
                title = trackNumber is null ? fileName : fileName.Split(' ', 2).ElementAtOrDefault(1),
                artists = Array.Empty<string>(),
                albumTitle = (string?)null,
                albumArtists = new[] { "Archive" },
                catalogNumber = (string?)null,
                releaseDate = "2026",
                year = (int?)2026,
                durationSeconds = (int?)null,
                trackNumber
            },
            coverArtifact = (object?)null
        };
    }

    private static async Task<JsonDocument> PostScanAsync(HttpClient client, string rootPath, params object[] files)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = rootPath,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return await ReadJsonAsync(response);
    }

    private static async Task ConfirmOnlyDraftAsync(HttpClient client, JsonDocument scan)
    {
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        using HttpResponseMessage response = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
    }
}
