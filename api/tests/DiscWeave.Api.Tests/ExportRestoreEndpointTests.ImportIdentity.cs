using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ExportRestoreEndpointTests
{
    [Fact(DisplayName = "JSON restore does not preserve legacy owned item file identity")]
    public async Task Json_restore_does_not_preserve_legacy_owned_item_file_identity()
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
        HttpClient userClient = await CreateUserClientAsync(host, adminClient);

        using HttpResponseMessage restoreResponse = await PostRestoreAsync(userClient, snapshot);
        string restoreJson = await restoreResponse.Content.ReadAsStringAsync();
        using JsonDocument movedScan = await PostDesktopScanAsync(
            userClient,
            "/music/moved",
            DesktopAudioFile(
                "/music/moved",
                "/music/moved/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac"));
        JsonElement movedTrack = movedScan.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];

        Assert.True(restoreResponse.StatusCode == HttpStatusCode.OK, restoreJson);
        Assert.Equal(JsonValueKind.Null, movedTrack.GetProperty("selectedTrackId").ValueKind);
        Assert.DoesNotContain(
            movedTrack.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
    }
}
