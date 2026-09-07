using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    [Fact(DisplayName = "Saving a reviewed release date clears only the stale invalid date issue")]
    public async Task Saving_a_reviewed_release_date_clears_only_the_stale_invalid_date_issue()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[AA 01, 2022-00-00] Steven Julien - Fallen");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Begins.flac");
        await File.WriteAllTextAsync(audioPath, "fake flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scanDocument = await PostScanAsync(client, root.Path, audioPath, "21.10.2002");
        JsonElement draft = scanDocument.RootElement.GetProperty("drafts")[0];
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid draftId = draft.GetProperty("id").GetGuid();
        Assert.Contains(
            draft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "import.release_date_invalid");

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            DraftPreflightPayload(draft, "2002-10-21"));
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement savedDraft = document.RootElement.GetProperty("drafts")[0];
        Assert.Equal("ready", savedDraft.GetProperty("status").GetString());
        Assert.Equal("2002-10-21", savedDraft.GetProperty("releaseDate").GetString());
        Assert.DoesNotContain(
            savedDraft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "import.release_date_invalid");
        Assert.Contains(
            savedDraft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "import.release_date_partial");
    }
}
