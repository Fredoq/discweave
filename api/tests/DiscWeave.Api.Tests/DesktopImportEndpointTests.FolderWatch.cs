using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Appended folder scans add new releases to the session once")]
    public async Task Appended_folder_scans_add_new_releases_to_session_once()
    {
        using var root = TempImportRoot.Create();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        object firstFile = WatchedAlbumFile(root.Path, "First Album", "01 One.flac", "watch-hash-1");
        object secondFile = WatchedAlbumFile(root.Path, "Second Album", "01 Two.flac", "watch-hash-2");
        using JsonDocument scanDocument = await PostLooseScanAsync(client, root.Path, firstFile);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage appendResponse = await AppendScanAsync(client, sessionId, root.Path, [firstFile, secondFile]);
        using HttpResponseMessage repeatedResponse = await AppendScanAsync(client, sessionId, root.Path, [firstFile, secondFile]);
        using JsonDocument document = await ReadJsonAsync(repeatedResponse);

        Assert.Equal(HttpStatusCode.OK, appendResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, repeatedResponse.StatusCode);
        Assert.Equal(2, document.RootElement.GetProperty("draftCount").GetInt32());
        Assert.Equal(2, document.RootElement.GetProperty("trackCount").GetInt32());
        Assert.Equal(
            ["First Album", "Second Album"],
            [.. document.RootElement.GetProperty("drafts").EnumerateArray().Select(draft => draft.GetProperty("title").GetString() ?? string.Empty).Order()]);
    }

    [Fact(DisplayName = "Appended folder scans recreate only requested unconfirmed drafts")]
    public async Task Appended_folder_scans_recreate_only_requested_unconfirmed_drafts()
    {
        using var root = TempImportRoot.Create();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        object originalFile = WatchedAlbumFile(root.Path, "Changed Album", "01 One.flac", "watch-hash-3");
        using JsonDocument scanDocument = await PostLooseScanAsync(client, root.Path, originalFile);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scanDocument.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        object addedFile = WatchedAlbumFile(root.Path, "Changed Album", "02 Two.flac", "watch-hash-4");

        using HttpResponseMessage recreateResponse = await AppendScanAsync(client, sessionId, root.Path, [originalFile, addedFile], draftId);
        using JsonDocument recreated = await ReadJsonAsync(recreateResponse);
        JsonElement recreatedDraft = Assert.Single(recreated.RootElement.GetProperty("drafts").EnumerateArray());
        Guid recreatedDraftId = recreatedDraft.GetProperty("id").GetGuid();
        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{recreatedDraftId}/confirm", null);
        using HttpResponseMessage confirmedReplaceResponse = await AppendScanAsync(client, sessionId, root.Path, [originalFile, addedFile], recreatedDraftId);

        Assert.Equal(HttpStatusCode.OK, recreateResponse.StatusCode);
        Assert.NotEqual(draftId, recreatedDraftId);
        Assert.Equal(2, recreatedDraft.GetProperty("tracks").GetArrayLength());
        Assert.Equal(2, recreated.RootElement.GetProperty("trackCount").GetInt32());
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, confirmedReplaceResponse.StatusCode);
        Assert.Equal(2, (await host.LocalAudioFilesAsync()).Length);
    }

    [Fact(DisplayName = "Folder baseline compares catalog releases under the folder by catalog files and drafts by draft files")]
    public async Task Folder_baseline_reports_catalog_files_for_releases_under_the_folder()
    {
        using var root = TempImportRoot.Create();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument earlierScan = await PostLooseScanAsync(
            client,
            root.Path,
            WatchedAlbumFile(root.Path, "Confirmed Album", "01 One.flac", "watch-hash-5"));
        Guid earlierSessionId = earlierScan.RootElement.GetProperty("id").GetGuid();
        Guid confirmedDraftId = earlierScan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{earlierSessionId}/drafts/{confirmedDraftId}/confirm", null);
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            WatchedAlbumFile(root.Path, "Draft Album", "01 Two.flac", "watch-hash-6"),
            WatchedAlbumFile(root.Path, "Skipped Album", "01 Three.flac", "watch-hash-7"));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        var draftIds = scanDocument.RootElement.GetProperty("drafts").EnumerateArray().ToDictionary(
            draft => draft.GetProperty("title").GetString() ?? string.Empty,
            draft => draft.GetProperty("id").GetGuid());
        using HttpResponseMessage skipResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftIds["Skipped Album"]}/skip", null);

        using HttpResponseMessage response = await client.GetAsync($"/api/imports/{sessionId}/folder-baseline");
        using JsonDocument document = await ReadJsonAsync(response);
        using HttpResponseMessage archiveResponse = await client.PostAsync($"/api/imports/{sessionId}/archive", null);
        using HttpResponseMessage archivedResponse = await client.GetAsync($"/api/imports/{sessionId}/folder-baseline");

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, skipResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(root.Path, document.RootElement.GetProperty("sourceRoot").GetString());
        JsonElement[] entries = [.. document.RootElement.GetProperty("drafts").EnumerateArray()];
        Assert.Equal(2, entries.Length);
        JsonElement release = entries.Single(entry => entry.GetProperty("status").GetString() == "confirmed");
        JsonElement releaseFile = Assert.Single(release.GetProperty("files").EnumerateArray());
        LocalAudioFileSnapshot catalogFile = Assert.Single(await host.LocalAudioFilesAsync());
        Assert.Equal(JsonValueKind.Null, release.GetProperty("draftId").ValueKind);
        Assert.NotEqual(JsonValueKind.Null, release.GetProperty("releaseId").ValueKind);
        Assert.Equal("Confirmed Album", release.GetProperty("title").GetString());
        Assert.Equal(catalogFile.Id, releaseFile.GetProperty("localAudioFileId").GetGuid());
        Assert.Equal(catalogFile.Path, releaseFile.GetProperty("path").GetString());
        Assert.Equal(9, releaseFile.GetProperty("sizeBytes").GetInt64());
        JsonElement pending = entries.Single(entry => entry.GetProperty("status").GetString() == "ready");
        Assert.Equal(draftIds["Draft Album"], pending.GetProperty("draftId").GetGuid());
        Assert.Equal(JsonValueKind.Null, pending.GetProperty("releaseId").ValueKind);
        Assert.Equal(JsonValueKind.Null, Assert.Single(pending.GetProperty("files").EnumerateArray()).GetProperty("localAudioFileId").ValueKind);
        Assert.Equal(
            Path.Combine(root.Path, "Skipped Album", "01 Three.flac"),
            Assert.Single(document.RootElement.GetProperty("otherKnownPaths").EnumerateArray()).GetString());
        Assert.Equal(HttpStatusCode.OK, archiveResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, archivedResponse.StatusCode);
    }

    private static object WatchedAlbumFile(string rootPath, string album, string fileName, string contentHash)
    {
        return LooseAudioFileWithTags(
            rootPath,
            Path.Combine(rootPath, album, fileName),
            contentHash,
            title: Path.GetFileNameWithoutExtension(fileName),
            artists: ["Watched Artist"],
            albumTitle: album,
            albumArtists: ["Watched Artist"],
            trackNumber: int.Parse(fileName[..2], System.Globalization.CultureInfo.InvariantCulture));
    }

    private static async Task<HttpResponseMessage> AppendScanAsync(
        HttpClient client,
        Guid sessionId,
        string rootPath,
        object[] files,
        Guid? replaceDraftId = null)
    {
        return await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/desktop-folder-scans",
            new
            {
                scan = new
                {
                    sourceRoot = rootPath,
                    ignoredFileCount = 0,
                    diagnostics = Array.Empty<object>(),
                    files
                },
                replaceDraftIds = replaceDraftId is { } id ? new[] { id } : []
            });
    }
}
