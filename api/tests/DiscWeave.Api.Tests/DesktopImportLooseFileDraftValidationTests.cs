using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Loose draft creation rejects already consumed candidates")]
    public async Task Loose_draft_creation_rejects_already_consumed_candidates()
    {
        using var root = TempImportRoot.Create();
        string audioPath = Path.Combine(root.Path, "Root Single.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFile(root.Path, audioPath, "single-hash", title: "Root Single"));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid candidateId = Assert.Single(scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray()).GetProperty("id").GetGuid();
        using HttpResponseMessage firstResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds = new[] { candidateId } });
        _ = await ReadJsonAsync(firstResponse);

        using HttpResponseMessage secondResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds = new[] { candidateId } });
        using JsonDocument secondDocument = await ReadJsonAsync(secondResponse);

        Assert.Equal(HttpStatusCode.BadRequest, secondResponse.StatusCode);
        Assert.Equal("release_import_loose_file.already_consumed", secondDocument.RootElement.GetProperty("code").GetString());
    }
}
