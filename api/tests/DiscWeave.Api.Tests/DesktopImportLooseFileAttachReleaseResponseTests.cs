using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Release tracklist exposes linked local file state after loose attach")]
    public async Task Release_tracklist_exposes_linked_local_file_state_after_loose_attach()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "01 Linked State.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateAttachArtistAsync(client, "Loose Artist");
        using JsonDocument releaseDocument = await CreateAttachReleaseAsync(
            client,
            "Linked State Release",
            artistId,
            [
                new
                {
                    title = "Linked State",
                    position = 1,
                    durationSeconds = 123,
                    artistCredits = Array.Empty<object>()
                }
            ]);
        Guid releaseId = releaseDocument.RootElement.GetProperty("id").GetGuid();
        Guid releaseTrackId = releaseDocument.RootElement.GetProperty("tracklist")[0].GetProperty("releaseTrackId").GetGuid();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, audioPath, "linked-state-hash", title: "Linked State", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();
        using JsonDocument attachDocument = await AttachLooseFileAsync(
            client,
            sessionId,
            releaseId,
            candidateId,
            releaseTrackId,
            confirmRelink: false);

        using HttpResponseMessage response = await client.GetAsync($"/api/releases/{releaseId}");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("consumed", Assert.Single(attachDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("decision").GetString());
        JsonElement tracklistItem = Assert.Single(document.RootElement.GetProperty("tracklist").EnumerateArray());
        JsonElement linkedFile = Assert.Single(tracklistItem.GetProperty("linkedLocalFiles").EnumerateArray());
        Assert.Equal(audioPath, linkedFile.GetProperty("path").GetString());
        Assert.Equal("linked-state-hash", linkedFile.GetProperty("contentHash").GetString());
        Assert.Equal("flac", linkedFile.GetProperty("format").GetString());
    }
}
