using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "Required relation failure rolls back release tracks target marker and relation")]
    public async Task Required_relation_failure_rolls_back_release_tracks_target_marker_and_relation()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 82, 1998] Run-DMC - Required Rollback");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        string instrumentalTrackPath = Path.Combine(releaseDirectory, "03 Instrumental.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await File.WriteAllTextAsync(instrumentalTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid existingTargetId = await CreateTrackAsync(client, "Catalog Original Candidate");

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
            AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2),
            AudioFile(root.Path, instrumentalTrackPath, "It's Like That (Instrumental)", trackNumber: 3));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        JsonElement[] suggestions =
        [
            .. scan.RootElement.GetProperty("relationSuggestions")
                .EnumerateArray()
                .OrderBy(suggestion => suggestion.GetProperty("id").GetGuid())
        ];
        Assert.Equal(2, suggestions.Length);
        Guid validSourceId = suggestions[0].GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid();
        Guid invalidSourceId = suggestions[1].GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid();
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[0].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = validSourceId },
            new { kind = "existingTrack", id = existingTargetId });
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestions[1].GetProperty("id").GetGuid(),
            new { kind = "draftTrack", id = invalidSourceId },
            new { kind = "draftTrack", id = invalidSourceId });
        await MarkRelationSuggestionsRequiredAsync(host);

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage targetResponse = await client.GetAsync($"/api/tracks/{existingTargetId}");
        using JsonDocument target = await ReadJsonAsync(targetResponse);

        Assert.Equal(HttpStatusCode.BadRequest, confirmResponse.StatusCode);
        Assert.Equal("track_relation.stack_self_relation", confirmation.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, targetResponse.StatusCode);
        Assert.False(target.RootElement.GetProperty("isOriginal").GetBoolean());
        await AssertRelationListTotalAsync(client, "/api/releases?limit=10&offset=0", 0);
        await AssertRelationListTotalAsync(client, "/api/tracks?limit=10&offset=0", 1);
        await AssertRelationListTotalAsync(client, "/api/track-relations?limit=10&offset=0", 0);
    }

    [Fact(DisplayName = "An identical Required relation confirms idempotently after its type leaves stack settings")]
    public async Task An_identical_Required_relation_confirms_idempotently_after_its_type_leaves_stack_settings()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 83, 1998] Run-DMC - Required Idempotent");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid existingSourceId = await CreateTrackAsync(client, "Existing Radio Edit");
        Guid existingTargetId = await CreateTrackAsync(client, "Existing Original");
        await CreateStackRelationAsync(client, existingSourceId, existingTargetId);

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
            AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scan.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestionId,
            new { kind = "existingTrack", id = existingSourceId },
            new { kind = "existingTrack", id = existingTargetId });
        await MarkRelationSuggestionsRequiredAsync(host);
        await SetTrackStackRelationTypesAsync(client, "remixOf");

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmation.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        await AssertRelationListTotalAsync(client, "/api/track-relations?type=versionOf&limit=10&offset=0", 1);
    }

    [Fact(DisplayName = "A Required existing source to draft target relation keeps its reviewed direction")]
    public async Task A_Required_existing_source_to_draft_target_relation_keeps_its_reviewed_direction()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 84, 1998] Run-DMC - Required Direction");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid existingSourceId = await CreateTrackAsync(client, "Existing Catalog Version");

        using JsonDocument scan = await ScanRelationDraftAsync(
            client,
            root.Path,
            AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
            AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        Guid targetDraftTrackId = FindTrackByTitle(scan.RootElement, "It's Like That").GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scan.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            suggestionId,
            new { kind = "existingTrack", id = existingSourceId },
            new { kind = "draftTrack", id = targetDraftTrackId });
        await MarkRelationSuggestionsRequiredAsync(host);

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync(
            "/api/track-relations?type=versionOf&limit=10&offset=0");
        using JsonDocument relations = await ReadJsonAsync(relationsResponse);
        JsonElement relation = Assert.Single(relations.RootElement.GetProperty("items").EnumerateArray());
        Guid targetTrackId = relation.GetProperty("targetTrackId").GetGuid();
        using HttpResponseMessage targetResponse = await client.GetAsync($"/api/tracks/{targetTrackId}");
        using JsonDocument target = await ReadJsonAsync(targetResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmation.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        Assert.Equal(existingSourceId, relation.GetProperty("sourceTrackId").GetGuid());
        Assert.Equal("It's Like That", relation.GetProperty("targetTrackTitle").GetString());
        Assert.True(target.RootElement.GetProperty("isOriginal").GetBoolean());
    }
}
