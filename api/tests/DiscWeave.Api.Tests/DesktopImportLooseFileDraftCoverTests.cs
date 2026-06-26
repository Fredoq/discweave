using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Loose candidates create draft with same-folder cover")]
    public async Task Loose_candidates_create_draft_with_same_folder_cover()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "Loose Album");
        _ = Directory.CreateDirectory(releaseDirectory);
        string firstPath = Path.Combine(releaseDirectory, "01 First.flac");
        string secondPath = Path.Combine(releaseDirectory, "02 Second.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(firstPath, "fake flac 1");
        await File.WriteAllTextAsync(secondPath, "fake flac 2");
        await File.WriteAllTextAsync(coverPath, "cover bytes");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scanDocument = await PostLooseScanAsync(
            client,
            root.Path,
            LooseAudioFileWithTags(root.Path, firstPath, "first-hash", title: "First", albumTitle: "Album A", trackNumber: 1),
            LooseAudioFileWithTags(root.Path, secondPath, "second-hash", title: "Second", albumTitle: "Album B", trackNumber: 2));
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid[] candidateIds = [.. scanDocument.RootElement.GetProperty("looseFileCandidates").EnumerateArray().Select(candidate => candidate.GetProperty("id").GetGuid())];

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-drafts",
            new { candidateIds });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement draft = Assert.Single(document.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Equal(coverPath, draft.GetProperty("coverPath").GetString());
    }
}
