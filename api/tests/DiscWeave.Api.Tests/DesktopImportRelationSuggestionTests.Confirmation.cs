using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "Required preflight includes earlier BestEffort relations in confirmation order")]
    public async Task Required_preflight_includes_earlier_BestEffort_relations_in_confirmation_order()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 87, 1998] Run-DMC - Mixed Relation Modes");
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
        Guid requiredSuggestionId = suggestions[1].GetProperty("id").GetGuid();
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            requiredSuggestionId,
            new { kind = "draftTrack", id = sourceDraftTrackId },
            new { kind = "draftTrack", id = instrumentalDraftTrackId });
        await MarkRelationSuggestionRequiredAsync(host, requiredSuggestionId);
        using HttpResponseMessage reviewResponse = await client.GetAsync(
            $"/api/imports/{sessionId}");
        using JsonDocument review = await ReadJsonAsync(reviewResponse);
        JsonElement requiredSuggestion = Assert.Single(
            review.RootElement.GetProperty("relationSuggestions").EnumerateArray(),
            suggestion => suggestion.GetProperty("id").GetGuid() ==
                requiredSuggestionId);
        Assert.Equal(
            "required",
            requiredSuggestion.GetProperty("applicationMode").GetString());

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

    [Fact(DisplayName = "Required preflight skips invalid earlier BestEffort relations")]
    public async Task Required_preflight_skips_invalid_earlier_BestEffort_relations()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 88, 1998] Run-DMC - Skipped BestEffort");
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
            new { kind = "draftTrack", id = sourceDraftTrackId });
        Guid requiredSuggestionId = suggestions[1].GetProperty("id").GetGuid();
        await AcceptRelationSuggestionAsync(
            client,
            sessionId,
            requiredSuggestionId,
            new { kind = "draftTrack", id = sourceDraftTrackId },
            new { kind = "draftTrack", id = instrumentalDraftTrackId });
        await MarkRelationSuggestionRequiredAsync(host, requiredSuggestionId);

        using HttpResponseMessage preflightResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight",
            RequiredRelationDraftUpdate(draft));
        using JsonDocument preflight = await ReadJsonAsync(preflightResponse);
        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            content: null);
        using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.OK, preflightResponse.StatusCode);
        Assert.True(preflight.RootElement.GetProperty("canConfirm").GetBoolean());
        Assert.Empty(preflight.RootElement.GetProperty("blockingErrors").EnumerateArray());
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        JsonElement confirmedDraft = confirmation.RootElement.GetProperty("drafts")[0];
        Assert.Equal("confirmed", confirmedDraft.GetProperty("status").GetString());
        Assert.Contains(
            confirmedDraft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() ==
                "release_import_relation.self_resolved");
        await AssertRelationListTotalAsync(client, "/api/releases?limit=10&offset=0", 1);
        await AssertRelationListTotalAsync(client, "/api/tracks?limit=10&offset=0", 3);
        await AssertRelationListTotalAsync(client, "/api/track-relations?limit=10&offset=0", 1);
    }

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

    [Fact(DisplayName = "Accepted relation suggestions create track relations when the draft is confirmed")]
    public async Task Accepted_relation_suggestions_create_track_relations_when_the_draft_is_confirmed()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 27, 1998] Run-DMC - Accepted Relation");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string breakTrackPath = Path.Combine(releaseDirectory, "02 Break.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "03 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(breakTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, breakTrackPath, "It's Like That (Drop The Break)", trackNumber: 2),
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Drop The Break) (Radio Edit)", trackNumber: 3)
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scanDocument.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid baseDraftTrackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();
        Guid radioEditDraftTrackId = draft.GetProperty("tracks")[2].GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();
        Assert.Equal(
            "bestEffort",
            Assert.Single(scanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray())
                .GetProperty("applicationMode")
                .GetString());

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "draftTrack", id = radioEditDraftTrackId },
                    target = new { kind = "draftTrack", id = baseDraftTrackId },
                    relationTypeCode = "versionOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        JsonElement updatedSuggestion = Assert.Single(updateDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray());
        Assert.Equal("accepted", updatedSuggestion.GetProperty("decision").GetString());
        Assert.Equal(radioEditDraftTrackId, updatedSuggestion.GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid());
        Assert.Equal(baseDraftTrackId, updatedSuggestion.GetProperty("reviewed").GetProperty("target").GetProperty("id").GetGuid());
        Assert.Equal("versionOf", updatedSuggestion.GetProperty("reviewed").GetProperty("relationTypeCode").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", content: null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync("/api/track-relations?type=versionOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        JsonElement relation = Assert.Single(relationsDocument.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal("versionOf", relation.GetProperty("type").GetString());
        Assert.Equal("It's Like That (Drop The Break) (Radio Edit)", relation.GetProperty("sourceTrackTitle").GetString());
        Assert.Equal("It's Like That", relation.GetProperty("targetTrackTitle").GetString());

        using HttpResponseMessage lateUpdateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new { decision = "rejected", reviewed = (object?)null });
        using JsonDocument lateUpdateDocument = await ReadJsonAsync(lateUpdateResponse);
        Assert.Equal(HttpStatusCode.BadRequest, lateUpdateResponse.StatusCode);
        Assert.Equal("release_import_relation_suggestion.draft_confirmed", lateUpdateDocument.RootElement.GetProperty("code").GetString());
    }

    private static async Task<JsonDocument> ScanRelationDraftAsync(
        HttpClient client,
        string sourceRoot,
        params object[] files)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files
            });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return JsonDocument.Parse(document.RootElement.GetRawText());
    }

    private static async Task AcceptRelationSuggestionAsync(
        HttpClient client,
        Guid sessionId,
        Guid suggestionId,
        object source,
        object target)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source,
                    target,
                    relationTypeCode = "versionOf"
                }
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static Task MarkRelationSuggestionsRequiredAsync(ApiTestHost host)
    {
        return host.ExecuteSqlAsync(
            "UPDATE release_import_relation_suggestions SET application_mode = 'Required';");
    }

    private static Task MarkRelationSuggestionRequiredAsync(
        ApiTestHost host,
        Guid suggestionId)
    {
        return host.MarkReleaseImportRelationSuggestionRequiredAsync(
            suggestionId);
    }

    private static async Task SetTrackStackRelationTypesAsync(
        HttpClient client,
        params string[] relationTypeCodes)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            "/api/settings/track-stack",
            new { defaultRelationTypeCodes = relationTypeCodes });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task CreateStackRelationAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid targetTrackId)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations/stack",
            new
            {
                sourceTrackId,
                targetTrackId,
                type = "versionOf",
                markTargetAsOriginal = true
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static async Task AssertRelationListTotalAsync(
        HttpClient client,
        string route,
        int expected)
    {
        using HttpResponseMessage response = await client.GetAsync(route);
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(expected, document.RootElement.GetProperty("total").GetInt32());
    }

    private static object RequiredRelationDraftUpdate(JsonElement draft)
    {
        return new
        {
            title = draft.GetProperty("title").GetString(),
            type = draft.GetProperty("type").GetString(),
            catalogNumber = draft.GetProperty("catalogNumber").ValueKind == JsonValueKind.Null
                ? null
                : draft.GetProperty("catalogNumber").GetString(),
            labelName = draft.GetProperty("labelName").ValueKind == JsonValueKind.Null
                ? null
                : draft.GetProperty("labelName").GetString(),
            releaseDate = draft.GetProperty("releaseDate").ValueKind == JsonValueKind.Null
                ? null
                : draft.GetProperty("releaseDate").GetString(),
            year = draft.GetProperty("year").ValueKind == JsonValueKind.Null
                ? (int?)null
                : draft.GetProperty("year").GetInt32(),
            isVariousArtists = draft.GetProperty("isVariousArtists").GetBoolean(),
            notOnLabel = draft.GetProperty("notOnLabel").GetBoolean(),
            createCatalogTracks = draft.GetProperty("createCatalogTracks").GetBoolean(),
            coverPath = draft.GetProperty("coverPath").ValueKind == JsonValueKind.Null
                ? null
                : draft.GetProperty("coverPath").GetString(),
            artistNames = draft.GetProperty("artistNames").EnumerateArray().Select(value => value.GetString()).ToArray(),
            artistCredits = Array.Empty<object>(),
            labels = Array.Empty<object>(),
            selectedArtistIds = Array.Empty<Guid>(),
            genres = draft.GetProperty("genres").EnumerateArray().Select(value => value.GetString()).ToArray(),
            tags = draft.GetProperty("tags").EnumerateArray().Select(value => value.GetString()).ToArray(),
            externalSources = Array.Empty<object>(),
            tracks = draft.GetProperty("tracks").EnumerateArray().Select(track => new
            {
                id = track.GetProperty("id").GetGuid(),
                trackMode = track.GetProperty("trackMode").GetString(),
                position = track.GetProperty("position").ValueKind == JsonValueKind.Null
                    ? (int?)null
                    : track.GetProperty("position").GetInt32(),
                disc = track.GetProperty("disc").ValueKind == JsonValueKind.Null
                    ? null
                    : track.GetProperty("disc").GetString(),
                side = track.GetProperty("side").ValueKind == JsonValueKind.Null
                    ? null
                    : track.GetProperty("side").GetString(),
                title = track.GetProperty("title").GetString(),
                versionYear = track.GetProperty("versionYear").ValueKind == JsonValueKind.Null
                    ? (int?)null
                    : track.GetProperty("versionYear").GetInt32(),
                durationSeconds = track.GetProperty("durationSeconds").ValueKind == JsonValueKind.Null
                    ? (int?)null
                    : track.GetProperty("durationSeconds").GetInt32(),
                artistNames = track.GetProperty("artistNames").EnumerateArray().Select(value => value.GetString()).ToArray(),
                artistCredits = Array.Empty<object>(),
                inheritReleaseArtistCredits = track.GetProperty("inheritReleaseArtistCredits").GetBoolean(),
                selectedArtistIds = Array.Empty<Guid>(),
                selectedTrackId = track.GetProperty("selectedTrackId").ValueKind == JsonValueKind.Null
                    ? (Guid?)null
                    : track.GetProperty("selectedTrackId").GetGuid(),
                isSkipped = track.GetProperty("isSkipped").GetBoolean()
            }).ToArray()
        };
    }

    [Fact(DisplayName = "Confirmed drafts keep warning issues when accepted relation suggestions resolve to the same track")]
    public async Task Confirmed_drafts_keep_warning_issues_when_accepted_relation_suggestions_resolve_to_the_same_track()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 27, 1998] Run-DMC - Self Relation");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2)
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scanDocument.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid radioEditDraftTrackId = draft.GetProperty("tracks")[1].GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "draftTrack", id = radioEditDraftTrackId },
                    target = new { kind = "draftTrack", id = radioEditDraftTrackId },
                    relationTypeCode = "versionOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal("accepted", Assert.Single(updateDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("decision").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", content: null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync("/api/track-relations?type=versionOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        JsonElement confirmedDraft = confirmDocument.RootElement.GetProperty("drafts")[0];
        Assert.Equal("confirmed", confirmedDraft.GetProperty("status").GetString());
        Assert.Contains(
            confirmedDraft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import_relation.self_resolved");
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.Equal(0, relationsDocument.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Desktop scan respects base to variant parser rule direction")]
    public async Task Desktop_scan_respects_base_to_variant_parser_rule_direction()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 27, 1998] Run-DMC - Direction");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string versionTrackPath = Path.Combine(releaseDirectory, "02 Version.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(versionTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        await CreateDictionaryEntryAsync(client, "containsVersion", "Contains version");
        await CreateParserRuleAsync(client, "containsVersion", "Included Version", "baseToVariant");

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, versionTrackPath, "It's Like That (Included Version)", trackNumber: 2)
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement baseTrack = FindTrackByTitle(document.RootElement, "It's Like That");
        JsonElement versionTrack = FindTrackByTitle(document.RootElement, "It's Like That (Included Version)");
        JsonElement suggestion = Assert.Single(document.RootElement.GetProperty("relationSuggestions").EnumerateArray());
        Assert.Equal("containsVersion", suggestion.GetProperty("reviewed").GetProperty("relationTypeCode").GetString());
        Assert.Equal(baseTrack.GetProperty("id").GetGuid(), suggestion.GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid());
        Assert.Equal(versionTrack.GetProperty("id").GetGuid(), suggestion.GetProperty("reviewed").GetProperty("target").GetProperty("id").GetGuid());
        JsonElement targetOption = Assert.Single(suggestion.GetProperty("targetOptions").EnumerateArray());
        Assert.Equal(baseTrack.GetProperty("id").GetGuid(), targetOption.GetProperty("id").GetGuid());
    }

    [Fact(DisplayName = "Relation suggestions cannot be changed after the owning draft is skipped")]
    public async Task Relation_suggestions_cannot_be_changed_after_the_owning_draft_is_skipped()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 27, 1998] Run-DMC - Skipped Relation");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2)
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scanDocument.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid radioEditDraftTrackId = draft.GetProperty("tracks")[1].GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage skipResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/skip", content: null);
        Assert.Equal(HttpStatusCode.OK, skipResponse.StatusCode);

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "draftTrack", id = radioEditDraftTrackId },
                    target = new { kind = "draftTrack", id = radioEditDraftTrackId },
                    relationTypeCode = "versionOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Equal("release_import_relation_suggestion.draft_skipped", updateDocument.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Relation suggestion updates reject an existing track source from another collection")]
    public async Task Relation_suggestion_updates_reject_an_existing_track_source_from_another_collection()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 29, 1998] Run-DMC - Foreign Existing Source");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "02 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient owner, HttpClient other) = await CreateAuthenticatedClientsAsync(host);
        Guid foreignTrackId = await CreateTrackAsync(other, "Foreign Catalog Version");

        using HttpResponseMessage scanResponse = await owner.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2)
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        Guid targetDraftTrackId = FindTrackByTitle(scanDocument.RootElement, "It's Like That").GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray())
            .GetProperty("id")
            .GetGuid();

        using HttpResponseMessage updateResponse = await owner.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "existingTrack", id = foreignTrackId },
                    target = new { kind = "draftTrack", id = targetDraftTrackId },
                    relationTypeCode = "versionOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Equal(
            "release_import_relation_suggestion.track_not_found",
            updateDocument.RootElement.GetProperty("code").GetString());
    }
}
