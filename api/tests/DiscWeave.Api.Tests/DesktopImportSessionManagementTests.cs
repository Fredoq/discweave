using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class DesktopImportSessionManagementTests : IClassFixture<SqliteFixture>
{
    private const string DeleteConfirmation = "delete-abandoned-import-session";
    private readonly SqliteFixture _sqlite;

    public DesktopImportSessionManagementTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Import session list filters by review status and cleanup flags")]
    public async Task Import_session_list_filters_by_review_status_and_cleanup_flags()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument confirmed = await PostAlbumScanAsync(client, "/music/confirmed", "Confirmed", "confirmed-hash");
        await ConfirmOnlyDraftAsync(client, confirmed);
        using JsonDocument skipped = await PostAlbumScanAsync(client, "/music/skipped", "Skipped", "skipped-hash");
        await SkipOnlyDraftAsync(client, skipped);
        using JsonDocument ready = await PostAlbumScanAsync(client, "/music/ready", "Ready", "ready-hash");
        using JsonDocument loose = await PostLooseScanAsync(client, "/music/loose", "Loose Root", "loose-hash");
        using JsonDocument warning = await PostAlbumScanAsync(
            client,
            "/music/warning",
            "Warning",
            "warning-hash",
            diagnostics:
            [
                new
                {
                    code = "cover_too_large",
                    message = "Cover is too large",
                    severity = "warning",
                    filePath = "/music/warning/cover.jpg",
                    relativePath = "cover.jpg",
                    extension = ".jpg",
                    sizeBytes = (long?)123,
                    source = "cover"
                }
            ]);
        using JsonDocument missingHash = await PostAlbumScanAsync(client, "/music/missing-hash", "Missing Hash", null);
        using JsonDocument duplicate = await PostAlbumScanAsync(client, "/music/duplicate", "Confirmed", "confirmed-hash");

        AssertListContainsOnly(await ListAsync(client, "confirmed"), SessionId(confirmed));
        AssertListContainsOnly(await ListAsync(client, "skipped"), SessionId(skipped));
        AssertListContains(await ListAsync(client, "ready"), SessionId(ready), SessionId(loose), SessionId(warning), SessionId(missingHash), SessionId(duplicate));
        AssertListContainsOnly(await ListAsync(client, "hasLooseFiles"), SessionId(loose));
        AssertListContains(await ListAsync(client, "hasWarningsOrErrors"), SessionId(warning), SessionId(missingHash), SessionId(duplicate));
        AssertListContainsOnly(await ListAsync(client, "missingHashes"), SessionId(missingHash));
        AssertListContainsOnly(await ListAsync(client, "duplicateMatches"), SessionId(duplicate));
    }

    [Fact(DisplayName = "Archiving hides import sessions without deleting them")]
    public async Task Archiving_hides_import_sessions_without_deleting_them()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scan = await PostAlbumScanAsync(client, "/music/archive", "Archive Me", "archive-hash");
        Guid sessionId = SessionId(scan);

        using HttpResponseMessage archiveResponse = await client.PostAsync($"/api/imports/{sessionId}/archive", null);
        using JsonDocument archiveDocument = await ReadJsonAsync(archiveResponse);
        JsonElement defaultList = await ListAsync(client, null);
        JsonElement archivedList = await ListAsync(client, null, includeArchived: true);
        using HttpResponseMessage detailResponse = await client.GetAsync($"/api/imports/{sessionId}");
        using JsonDocument detailDocument = await ReadJsonAsync(detailResponse);

        Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);
        Assert.Equal(sessionId, archiveDocument.RootElement.GetProperty("id").GetGuid());
        Assert.NotEqual(JsonValueKind.Null, archiveDocument.RootElement.GetProperty("archivedAt").ValueKind);
        Assert.DoesNotContain(defaultList.GetProperty("items").EnumerateArray(), item => item.GetProperty("id").GetGuid() == sessionId);
        Assert.Contains(archivedList.GetProperty("items").EnumerateArray(), item => item.GetProperty("id").GetGuid() == sessionId);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        Assert.NotEqual(JsonValueKind.Null, detailDocument.RootElement.GetProperty("archivedAt").ValueKind);
    }

    [Fact(DisplayName = "Deleting abandoned sessions requires confirmation and keeps confirmed catalog data safe")]
    public async Task Deleting_abandoned_sessions_requires_confirmation_and_keeps_confirmed_catalog_data_safe()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument abandoned = await PostAlbumScanAsync(client, "/music/abandoned", "Abandoned", "abandoned-hash");
        Guid abandonedSessionId = SessionId(abandoned);
        using JsonDocument confirmed = await PostAlbumScanAsync(client, "/music/keep", "Keep Catalog", "keep-hash");
        Guid confirmedSessionId = SessionId(confirmed);
        await ConfirmOnlyDraftAsync(client, confirmed);

        using HttpResponseMessage missingConfirmation = await client.DeleteAsync($"/api/imports/{abandonedSessionId}");
        using JsonDocument missingConfirmationDocument = await ReadJsonAsync(missingConfirmation);
        using HttpResponseMessage deleted = await DeleteSessionAsync(client, abandonedSessionId, DeleteConfirmation);
        using HttpResponseMessage deletedDetail = await client.GetAsync($"/api/imports/{abandonedSessionId}");
        using HttpResponseMessage blockedConfirmed = await DeleteSessionAsync(client, confirmedSessionId, DeleteConfirmation);
        using JsonDocument blockedDocument = await ReadJsonAsync(blockedConfirmed);
        using HttpResponseMessage releaseResponse = await client.GetAsync("/api/releases?search=Keep-Catalog&limit=10&offset=0");
        using JsonDocument releaseDocument = await ReadJsonAsync(releaseResponse);

        Assert.Equal(HttpStatusCode.BadRequest, missingConfirmation.StatusCode);
        Assert.Equal("release_import.delete_confirmation_required", missingConfirmationDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, deletedDetail.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, blockedConfirmed.StatusCode);
        Assert.Equal("release_import.confirmed_cannot_delete", blockedDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(1, releaseDocument.RootElement.GetProperty("total").GetInt32());
    }

    private static async Task<JsonElement> ListAsync(HttpClient client, string? filter, bool includeArchived = false)
    {
        string query = filter is null ? string.Empty : $"filter={Uri.EscapeDataString(filter)}&";
        using HttpResponseMessage response = await client.GetAsync($"/api/imports?{query}includeArchived={includeArchived.ToString().ToLowerInvariant()}&limit=100&offset=0");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonDocument document = await ReadJsonAsync(response);
        return document.RootElement.Clone();
    }

    private static async Task<HttpResponseMessage> DeleteSessionAsync(HttpClient client, Guid sessionId, string confirmation)
    {
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/imports/{sessionId}");
        request.Headers.Add("X-DiscWeave-Confirm-Delete", confirmation);
        return await client.SendAsync(request);
    }

    private static async Task<JsonDocument> PostAlbumScanAsync(
        HttpClient client,
        string rootPath,
        string title,
        string? contentHash,
        object[]? diagnostics = null)
    {
        string safeTitle = title.Replace(' ', '-');
        string filePath = $"{rootPath}/[DW 01, 2026] Archive - {safeTitle}/01 {safeTitle}.flac";
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = rootPath,
                ignoredFileCount = 0,
                diagnostics = diagnostics ?? [],
                files = new[] { AudioFile(rootPath, filePath, title, contentHash) }
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return await ReadJsonAsync(response);
    }

    private static async Task<JsonDocument> PostLooseScanAsync(HttpClient client, string rootPath, string title, string contentHash)
    {
        string filePath = $"{rootPath}/{title}.flac";
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = rootPath,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new[] { AudioFile(rootPath, filePath, title, contentHash) }
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return await ReadJsonAsync(response);
    }

    private static object AudioFile(string rootPath, string filePath, string title, string? contentHash)
    {
        return new
        {
            filePath,
            relativePath = Path.GetRelativePath(rootPath, filePath),
            format = "flac",
            sizeBytes = 9,
            lastModifiedAt = DateTimeOffset.UtcNow,
            contentHash,
            audioMetadata = new
            {
                title,
                artists = Array.Empty<string>(),
                albumTitle = (string?)null,
                albumArtists = new[] { "Archive" },
                catalogNumber = (string?)null,
                releaseDate = "2026",
                year = (int?)2026,
                durationSeconds = (int?)null,
                trackNumber = (int?)1
            },
            coverArtifact = (object?)null
        };
    }

    private static async Task ConfirmOnlyDraftAsync(HttpClient client, JsonDocument scan)
    {
        using HttpResponseMessage response = await client.PostAsync($"/api/imports/{SessionId(scan)}/drafts/{DraftId(scan)}/confirm", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task SkipOnlyDraftAsync(HttpClient client, JsonDocument scan)
    {
        using HttpResponseMessage response = await client.PostAsync($"/api/imports/{SessionId(scan)}/drafts/{DraftId(scan)}/skip", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static Guid SessionId(JsonDocument document)
    {
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static Guid DraftId(JsonDocument document)
    {
        return document.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
    }

    private static void AssertListContains(JsonElement list, params Guid[] sessionIds)
    {
        Guid[] actual = [.. list.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid())];
        foreach (Guid sessionId in sessionIds)
        {
            Assert.Contains(sessionId, actual);
        }
    }

    private static void AssertListContainsOnly(JsonElement list, params Guid[] sessionIds)
    {
        Guid[] actual = [.. list.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).Order()];
        Assert.Equal([.. sessionIds.Order()], actual);
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
    }
}
