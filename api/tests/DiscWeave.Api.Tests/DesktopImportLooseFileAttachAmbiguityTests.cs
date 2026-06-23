using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Loose attach rejects releases with multiple digital owned items")]
    public async Task Loose_attach_rejects_releases_with_multiple_digital_owned_items()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "01 Ambiguous.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateAttachArtistAsync(client, "Loose Artist");
        using JsonDocument releaseDocument = await CreateAttachReleaseAsync(
            client,
            "Ambiguous Digital Release",
            artistId,
            [
                new
                {
                    title = "Ambiguous",
                    position = 1,
                    durationSeconds = 123,
                    artistCredits = Array.Empty<object>()
                }
            ]);
        Guid releaseId = releaseDocument.RootElement.GetProperty("id").GetGuid();
        Guid releaseTrackId = releaseDocument.RootElement.GetProperty("tracklist")[0].GetProperty("releaseTrackId").GetGuid();
        _ = await CreateAttachDigitalOwnedItemAsync(client, releaseId);
        _ = await CreateAttachDigitalOwnedItemAsync(client, releaseId);
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, audioPath, "ambiguous-hash", title: "Ambiguous", artists: ["Loose Artist"]));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId, releaseTrackId, confirmRelink = false }
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("release_import_loose_file.digital_owned_item_ambiguous", document.RootElement.GetProperty("code").GetString());
        Assert.Empty(await host.LocalAudioFilesAsync());
        Assert.Empty(await host.DigitalTrackFileLinksAsync());
    }
}
