using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ExportRestoreEndpointTests
{
    [Fact(DisplayName = "JSON restore preserves local audio file identity for future duplicate scans")]
    public async Task Json_restore_preserves_local_audio_file_identity_for_future_duplicate_scans()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient adminClient = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scan = await PostDesktopScanAsync(
            adminClient,
            "/music/source",
            DesktopAudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac"));
        await ConfirmOnlyDesktopDraftAsync(adminClient, scan);
        string snapshot = await ExportJsonAsync(adminClient);
        using var snapshotDocument = JsonDocument.Parse(snapshot);
        JsonElement exportedLocalFile = Assert.Single(snapshotDocument.RootElement.GetProperty("localAudioFiles").EnumerateArray());
        JsonElement exportedFileLink = Assert.Single(snapshotDocument.RootElement.GetProperty("digitalTrackFileLinks").EnumerateArray());
        HttpClient userClient = await CreateUserClientAsync(host, adminClient);

        using HttpResponseMessage restoreResponse = await PostRestoreAsync(userClient, snapshot);
        string restoreJson = await restoreResponse.Content.ReadAsStringAsync();
        using var restoreDocument = JsonDocument.Parse(restoreJson);
        string restoredSnapshot = await ExportJsonAsync(userClient);
        using var restoredSnapshotDocument = JsonDocument.Parse(restoredSnapshot);
        using JsonDocument movedScan = await PostDesktopScanAsync(
            userClient,
            "/music/moved",
            DesktopAudioFile(
                "/music/moved",
                "/music/moved/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac"));
        JsonElement movedTrack = movedScan.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];

        Assert.True(restoreResponse.StatusCode == HttpStatusCode.OK, restoreJson);
        Assert.Equal(1, restoreDocument.RootElement.GetProperty("localAudioFiles").GetInt32());
        Assert.Equal(1, restoreDocument.RootElement.GetProperty("digitalTrackFileLinks").GetInt32());
        Assert.Equal(exportedLocalFile.GetProperty("id").GetGuid(), Assert.Single(restoredSnapshotDocument.RootElement.GetProperty("localAudioFiles").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.Equal(exportedFileLink.GetProperty("id").GetGuid(), Assert.Single(restoredSnapshotDocument.RootElement.GetProperty("digitalTrackFileLinks").EnumerateArray()).GetProperty("id").GetGuid());
        Assert.NotEqual(JsonValueKind.Null, movedTrack.GetProperty("selectedTrackId").ValueKind);
        Assert.Contains(
            movedTrack.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
    }
}
