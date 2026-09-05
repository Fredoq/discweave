using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "Required-first relation ordering is blocked by a later BestEffort member")]
    public async Task Required_first_relation_ordering_is_blocked_by_a_later_best_effort_member()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 91, 1998] Run-DMC - Required First");
        _ = Directory.CreateDirectory(releaseDirectory);
        string firstTrackPath = Path.Combine(releaseDirectory, "01 First.flac");
        string middleTrackPath = Path.Combine(releaseDirectory, "02 Middle.flac");
        string rootTrackPath = Path.Combine(releaseDirectory, "03 Root.flac");
        await File.WriteAllTextAsync(firstTrackPath, "flac");
        await File.WriteAllTextAsync(middleTrackPath, "flac");
        await File.WriteAllTextAsync(rootTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, firstTrackPath, "Song (Radio Edit)", trackNumber: 1),
            AudioFile(root.Path, middleTrackPath, "Song (Instrumental)", trackNumber: 2),
            AudioFile(root.Path, rootTrackPath, "Song", trackNumber: 3));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid firstDraftTrackId = FindTrackByTitle(scan.RootElement, "Song (Radio Edit)")
            .GetProperty("id")
            .GetGuid();
        Guid middleDraftTrackId = FindTrackByTitle(scan.RootElement, "Song (Instrumental)")
            .GetProperty("id")
            .GetGuid();
        Guid rootDraftTrackId = FindTrackByTitle(scan.RootElement, "Song")
            .GetProperty("id")
            .GetGuid();
        JsonElement[] suggestions =
        [
            .. scan.RootElement.GetProperty("relationSuggestions")
                .EnumerateArray()
                .OrderBy(suggestion => suggestion.GetProperty("id").GetGuid())
        ];
        Assert.Equal(2, suggestions.Length);

        Guid requiredSuggestionId = suggestions[0].GetProperty("id").GetGuid();
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            requiredSuggestionId,
            new { kind = "draftTrack", id = firstDraftTrackId },
            new { kind = "draftTrack", id = middleDraftTrackId });
        await MarkRelationSuggestionRequiredAsync(host, requiredSuggestionId);
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[1].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = middleDraftTrackId },
            new { kind = "draftTrack", id = rootDraftTrackId });

        using HttpResponseMessage preflightResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight",
            RequiredRelationDraftUpdate(draft));
        using JsonDocument preflight = await ReadJsonAsync(preflightResponse);
        JsonElement blockingError = Assert.Single(
            preflight.RootElement.GetProperty("blockingErrors").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() ==
                "track_relation.stack_target_not_standalone");

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.OK, preflightResponse.StatusCode);
        Assert.False(preflight.RootElement.GetProperty("canConfirm").GetBoolean());
        Assert.Equal("blocked", preflight.RootElement.GetProperty("outcome").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, confirmResponse.StatusCode);
        Assert.Equal(
            blockingError.GetProperty("code").GetString(),
            confirmation.RootElement.GetProperty("code").GetString());
        Assert.Equal(
            "Target track belongs to another stack",
            blockingError.GetProperty("message").GetString());
        Assert.Equal(
            "Target track belongs to another stack",
            confirmation.RootElement.GetProperty("message").GetString());
        await AssertRelationListTotalAsync(client, "/api/releases?limit=10&offset=0", 0);
        await AssertRelationListTotalAsync(client, "/api/tracks?limit=10&offset=0", 0);
        await AssertRelationListTotalAsync(client, "/api/track-relations?limit=10&offset=0", 0);
    }
}
