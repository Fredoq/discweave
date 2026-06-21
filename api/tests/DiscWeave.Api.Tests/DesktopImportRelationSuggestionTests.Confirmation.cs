using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
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

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "draftTrack", id = radioEditDraftTrackId },
                    target = new { kind = "draftTrack", id = baseDraftTrackId },
                    relationTypeCode = "editOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        JsonElement updatedSuggestion = Assert.Single(updateDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray());
        Assert.Equal("accepted", updatedSuggestion.GetProperty("decision").GetString());
        Assert.Equal(radioEditDraftTrackId, updatedSuggestion.GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid());
        Assert.Equal(baseDraftTrackId, updatedSuggestion.GetProperty("reviewed").GetProperty("target").GetProperty("id").GetGuid());
        Assert.Equal("editOf", updatedSuggestion.GetProperty("reviewed").GetProperty("relationTypeCode").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", content: null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync("/api/track-relations?type=editOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        JsonElement relation = Assert.Single(relationsDocument.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal("editOf", relation.GetProperty("type").GetString());
        Assert.Equal("It's Like That (Drop The Break) (Radio Edit)", relation.GetProperty("sourceTrackTitle").GetString());
        Assert.Equal("It's Like That", relation.GetProperty("targetTrackTitle").GetString());

        using HttpResponseMessage lateUpdateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new { decision = "rejected", reviewed = (object?)null });
        using JsonDocument lateUpdateDocument = await ReadJsonAsync(lateUpdateResponse);
        Assert.Equal(HttpStatusCode.BadRequest, lateUpdateResponse.StatusCode);
        Assert.Equal("release_import_relation_suggestion.draft_confirmed", lateUpdateDocument.RootElement.GetProperty("code").GetString());
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
                    relationTypeCode = "editOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal("accepted", Assert.Single(updateDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("decision").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", content: null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync("/api/track-relations?type=editOf&limit=10&offset=0");
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
                    relationTypeCode = "editOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Equal("release_import_relation_suggestion.draft_skipped", updateDocument.RootElement.GetProperty("code").GetString());
    }
}
