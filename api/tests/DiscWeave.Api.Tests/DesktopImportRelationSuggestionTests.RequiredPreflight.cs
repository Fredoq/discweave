using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "Required preflight validates accepted relations collectively in confirmation order")]
    public async Task Required_preflight_validates_accepted_relations_collectively_in_confirmation_order()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 85, 1998] Run-DMC - Required Collective");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        string instrumentalTrackPath = Path.Combine(releaseDirectory, "03 Instrumental.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await File.WriteAllTextAsync(instrumentalTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
            AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2),
            AudioFile(root.Path, instrumentalTrackPath, "It's Like That (Instrumental)", trackNumber: 3));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid sourceDraftTrackId = FindTrackByTitle(
            scan.RootElement,
            "It's Like That (Radio Edit)").GetProperty("id").GetGuid();
        Guid baseDraftTrackId = FindTrackByTitle(
            scan.RootElement,
            "It's Like That").GetProperty("id").GetGuid();
        Guid instrumentalDraftTrackId = FindTrackByTitle(
            scan.RootElement,
            "It's Like That (Instrumental)").GetProperty("id").GetGuid();
        JsonElement[] suggestions =
        [
            .. scan.RootElement.GetProperty("relationSuggestions")
                .EnumerateArray()
                .OrderBy(suggestion => suggestion.GetProperty("id").GetGuid())
        ];
        Assert.Equal(2, suggestions.Length);
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[0].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = sourceDraftTrackId },
            new { kind = "draftTrack", id = baseDraftTrackId });
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[1].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = sourceDraftTrackId },
            new { kind = "draftTrack", id = instrumentalDraftTrackId });
        await MarkRelationSuggestionsRequiredAsync(host);

        using HttpResponseMessage preflightResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight",
            RequiredRelationDraftUpdate(draft));
        using JsonDocument preflight = await ReadJsonAsync(preflightResponse);
        JsonElement collectiveFailure = Assert.Single(
            preflight.RootElement.GetProperty("blockingErrors").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() ==
                "track_relation.stack_source_not_standalone");
        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.OK, preflightResponse.StatusCode);
        Assert.False(preflight.RootElement.GetProperty("canConfirm").GetBoolean());
        Assert.Equal("blocked", preflight.RootElement.GetProperty("outcome").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, confirmResponse.StatusCode);
        Assert.Equal(
            collectiveFailure.GetProperty("code").GetString(),
            confirmation.RootElement.GetProperty("code").GetString());
        await AssertRelationListTotalAsync(client, "/api/releases?limit=10&offset=0", 0);
        await AssertRelationListTotalAsync(client, "/api/tracks?limit=10&offset=0", 0);
        await AssertRelationListTotalAsync(client, "/api/track-relations?limit=10&offset=0", 0);
    }

    [Fact(DisplayName = "A Required relation invalidated after preflight fails confirmation atomically")]
    public async Task A_Required_relation_invalidated_after_preflight_fails_confirmation_atomically()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 81, 1998] Run-DMC - Required Invalidated");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
            AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid baseDraftTrackId = FindTrackByTitle(scan.RootElement, "It's Like That").GetProperty("id").GetGuid();
        Guid radioEditDraftTrackId = FindTrackByTitle(scan.RootElement, "It's Like That (Radio Edit)").GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scan.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestionId,
            new { kind = "draftTrack", id = radioEditDraftTrackId },
            new { kind = "draftTrack", id = baseDraftTrackId });
        await MarkRelationSuggestionsRequiredAsync(host);

        using HttpResponseMessage preflightResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight",
            RequiredRelationDraftUpdate(draft));
        using JsonDocument preflight = await ReadJsonAsync(preflightResponse);
        Assert.Equal(HttpStatusCode.OK, preflightResponse.StatusCode);
        Assert.True(preflight.RootElement.GetProperty("canConfirm").GetBoolean());

        await SetTrackStackRelationTypesAsync(client, "remixOf");
        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.BadRequest, confirmResponse.StatusCode);
        Assert.Equal("track_relation.stack_type_invalid", confirmation.RootElement.GetProperty("code").GetString());
        await AssertRelationListTotalAsync(client, "/api/releases?limit=10&offset=0", 0);
        await AssertRelationListTotalAsync(client, "/api/tracks?limit=10&offset=0", 0);
        await AssertRelationListTotalAsync(client, "/api/track-relations?limit=10&offset=0", 0);
    }
}
