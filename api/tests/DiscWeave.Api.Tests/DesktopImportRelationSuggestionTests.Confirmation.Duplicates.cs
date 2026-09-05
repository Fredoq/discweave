using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "Duplicate BestEffort relations still promote a hidden target")]
    public async Task Duplicate_best_effort_relations_still_promote_a_hidden_target()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 92, 1998] Run-DMC - Duplicate Relation");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid existingSourceId = await CreateTrackAsync(client, "Existing Source");
        Guid hiddenTargetId = await CreateTrackAsync(client, "Hidden Target");
        await CreateRawTrackRelationAsync(client, existingSourceId, hiddenTargetId, "versionOf");

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
            AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(
            scan.RootElement.GetProperty("relationSuggestions").EnumerateArray())
            .GetProperty("id")
            .GetGuid();
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestionId,
            new { kind = "existingTrack", id = existingSourceId },
            new { kind = "existingTrack", id = hiddenTargetId });

        using HttpResponseMessage preflightResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight",
            RequiredRelationDraftUpdate(draft));
        using JsonDocument preflight = await ReadJsonAsync(preflightResponse);
        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationResponse = await client.GetAsync(
            "/api/track-relations?type=versionOf&limit=10&offset=0");
        using JsonDocument relations = await ReadJsonAsync(relationResponse);
        using HttpResponseMessage targetResponse = await client.GetAsync(
            $"/api/tracks/{hiddenTargetId}");
        using JsonDocument target = await ReadJsonAsync(targetResponse);

        Assert.Equal(HttpStatusCode.OK, preflightResponse.StatusCode);
        Assert.True(preflight.RootElement.GetProperty("canConfirm").GetBoolean());
        Assert.Empty(preflight.RootElement.GetProperty("blockingErrors").EnumerateArray());
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Contains(
            confirmation.RootElement.GetProperty("drafts")[0].GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import_relation.duplicate");
        Assert.Equal(HttpStatusCode.OK, relationResponse.StatusCode);
        Assert.Equal(1, relations.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.OK, targetResponse.StatusCode);
        Assert.True(target.RootElement.GetProperty("isOriginal").GetBoolean());
    }

    private static async Task CreateRawTrackRelationAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid targetTrackId,
        string type)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId, targetTrackId, type });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
