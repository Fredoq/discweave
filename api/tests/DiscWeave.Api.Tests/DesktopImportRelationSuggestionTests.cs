using DiscWeave.Api.Features.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class DesktopImportRelationSuggestionTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public DesktopImportRelationSuggestionTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Desktop scan suggests a track relation from the last parenthetical token")]
    public async Task Desktop_scan_suggests_a_track_relation_from_the_last_parenthetical_token()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 27, 1998] Run-DMC - Relation Test");
        _ = Directory.CreateDirectory(releaseDirectory);
        string baseTrackPath = Path.Combine(releaseDirectory, "01 Base.flac");
        string breakTrackPath = Path.Combine(releaseDirectory, "02 Break.flac");
        string radioEditTrackPath = Path.Combine(releaseDirectory, "03 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(breakTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, breakTrackPath, "It's Like That (Drop The Break)", trackNumber: 2),
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Drop The Break) (Radio Edit)", trackNumber: 3)
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement draft = document.RootElement.GetProperty("drafts")[0];
        JsonElement breakTrack = draft.GetProperty("tracks")[1];
        JsonElement radioEditTrack = draft.GetProperty("tracks")[2];
        JsonElement suggestions = document.RootElement.GetProperty("relationSuggestions");
        Assert.Equal(1, suggestions.GetArrayLength());
        JsonElement suggestion = suggestions[0];
        Assert.Equal(draft.GetProperty("id").GetGuid(), suggestion.GetProperty("draftId").GetGuid());
        Assert.Equal("Radio Edit", suggestion.GetProperty("token").GetString());
        Assert.Equal("pending", suggestion.GetProperty("decision").GetString());
        Assert.False(suggestion.GetProperty("isModified").GetBoolean());
        Assert.Equal("editOf", suggestion.GetProperty("suggested").GetProperty("relationTypeCode").GetString());
        Assert.Equal("editOf", suggestion.GetProperty("reviewed").GetProperty("relationTypeCode").GetString());
        Assert.Equal("draftTrack", suggestion.GetProperty("reviewed").GetProperty("source").GetProperty("kind").GetString());
        Assert.Equal(radioEditTrack.GetProperty("id").GetGuid(), suggestion.GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid());
        Assert.Equal("draftTrack", suggestion.GetProperty("reviewed").GetProperty("target").GetProperty("kind").GetString());
        Assert.Equal(breakTrack.GetProperty("id").GetGuid(), suggestion.GetProperty("reviewed").GetProperty("target").GetProperty("id").GetGuid());
        JsonElement targetOption = Assert.Single(suggestion.GetProperty("targetOptions").EnumerateArray());
        Assert.Equal("draftTrack", targetOption.GetProperty("kind").GetString());
        Assert.Equal(breakTrack.GetProperty("id").GetGuid(), targetOption.GetProperty("id").GetGuid());
    }

    [Fact(DisplayName = "Desktop scan can preselect cross draft relation suggestion targets in the same session")]
    public async Task Desktop_scan_can_preselect_cross_draft_relation_suggestion_targets_in_the_same_session()
    {
        using var root = TempImportRoot.Create();
        string firstReleaseDirectory = Path.Combine(root.Path, "[DW 27A, 1998] Run-DMC - Base");
        string secondReleaseDirectory = Path.Combine(root.Path, "[DW 27B, 1998] Run-DMC - Edit");
        _ = Directory.CreateDirectory(firstReleaseDirectory);
        _ = Directory.CreateDirectory(secondReleaseDirectory);
        string baseTrackPath = Path.Combine(firstReleaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(secondReleaseDirectory, "01 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 1)
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        JsonElement baseTrack = FindTrackByTitle(document.RootElement, "It's Like That");
        JsonElement radioEditTrack = FindTrackByTitle(document.RootElement, "It's Like That (Radio Edit)");
        JsonElement suggestion = Assert.Single(document.RootElement.GetProperty("relationSuggestions").EnumerateArray());
        Assert.Equal(radioEditTrack.GetProperty("id").GetGuid(), suggestion.GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid());
        Assert.Equal(baseTrack.GetProperty("id").GetGuid(), suggestion.GetProperty("reviewed").GetProperty("target").GetProperty("id").GetGuid());
    }

    [Fact(DisplayName = "Relation suggestion acceptance rejects cross draft draft targets")]
    public async Task Relation_suggestion_acceptance_rejects_cross_draft_draft_targets()
    {
        using var root = TempImportRoot.Create();
        string firstReleaseDirectory = Path.Combine(root.Path, "[DW 27A, 1998] Run-DMC - Base Reject");
        string secondReleaseDirectory = Path.Combine(root.Path, "[DW 27B, 1998] Run-DMC - Edit Reject");
        _ = Directory.CreateDirectory(firstReleaseDirectory);
        _ = Directory.CreateDirectory(secondReleaseDirectory);
        string baseTrackPath = Path.Combine(firstReleaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(secondReleaseDirectory, "01 Radio Edit.flac");
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
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 1)
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement baseTrack = FindTrackByTitle(scanDocument.RootElement, "It's Like That");
        JsonElement radioEditTrack = FindTrackByTitle(scanDocument.RootElement, "It's Like That (Radio Edit)");
        Guid suggestionId = Assert.Single(scanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "draftTrack", id = radioEditTrack.GetProperty("id").GetGuid() },
                    target = new { kind = "draftTrack", id = baseTrack.GetProperty("id").GetGuid() },
                    relationTypeCode = "editOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Equal("release_import_relation_suggestion.draft_track_not_found", updateDocument.RootElement.GetProperty("code").GetString());
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

    [Fact(DisplayName = "Relation suggestion analyzer extracts the last parenthetical token")]
    public void Relation_suggestion_analyzer_extracts_the_last_parenthetical_token()
    {
        RelationSuggestionAnalyzer.TitleToken? result = RelationSuggestionAnalyzer.TrySplitLastParenthetical(
            "It's Like That (Drop The Break) (Radio Edit)");

        Assert.NotNull(result);
        Assert.Equal("It's Like That (Drop The Break)", result.BaseTitle);
        Assert.Equal("Radio Edit", result.Token);
    }

    [Theory(DisplayName = "Relation suggestion analyzer ignores titles without final parenthetical tokens")]
    [InlineData("It's Like That")]
    [InlineData("It's Like That (Radio Edit) bonus")]
    [InlineData("It's Like That (Radio Edit")]
    [InlineData("It's Like That (unfinished (Radio Edit)")]
    public void Relation_suggestion_analyzer_ignores_titles_without_final_parenthetical_tokens(string title)
    {
        RelationSuggestionAnalyzer.TitleToken? result = RelationSuggestionAnalyzer.TrySplitLastParenthetical(title);

        Assert.Null(result);
    }

    [Theory(DisplayName = "Relation suggestion analyzer ignores empty base titles or tokens")]
    [InlineData("(Radio Edit)")]
    [InlineData("It's Like That ()")]
    [InlineData("It's Like That (   )")]
    public void Relation_suggestion_analyzer_ignores_empty_base_titles_or_tokens(string title)
    {
        RelationSuggestionAnalyzer.TitleToken? result = RelationSuggestionAnalyzer.TrySplitLastParenthetical(title);

        Assert.Null(result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer normalizes whitespace and case")]
    public void Relation_suggestion_analyzer_normalizes_whitespace_and_case()
    {
        string result = RelationSuggestionAnalyzer.NormalizeTitle("  Radio\t\n  EDIT  ");

        Assert.Equal("radio edit", result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer conservatively folds punctuation")]
    public void Relation_suggestion_analyzer_conservatively_folds_punctuation()
    {
        string result = RelationSuggestionAnalyzer.NormalizeTitleConservative("  It's--Like:That  ");

        Assert.Equal("it s like that", result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer matches active aliases by normalized token")]
    public void Relation_suggestion_analyzer_matches_active_aliases_by_normalized_token()
    {
        TrackRelationParserRule expectedRule = CreateRule(alias: "Radio   Edit", sortOrder: 10);
        TrackRelationParserRule[] rules =
        [
            CreateRule(alias: "Dub", sortOrder: 5),
            expectedRule
        ];

        TrackRelationParserRule? result = RelationSuggestionAnalyzer.MatchRule(" radio\tEDIT ", rules);

        Assert.Same(expectedRule, result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer ignores inactive rules and prefers the lowest sort order")]
    public void Relation_suggestion_analyzer_ignores_inactive_rules_and_prefers_the_lowest_sort_order()
    {
        TrackRelationParserRule inactiveRule = CreateRule(alias: "Radio Edit", sortOrder: 1, isActive: false);
        TrackRelationParserRule expectedRule = CreateRule(alias: "Radio Edit", sortOrder: 5);
        TrackRelationParserRule laterRule = CreateRule(alias: "Radio Edit", sortOrder: 10);
        TrackRelationParserRule[] rules = [laterRule, inactiveRule, expectedRule];

        TrackRelationParserRule? result = RelationSuggestionAnalyzer.MatchRule("Radio Edit", rules);

        Assert.Same(expectedRule, result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer resolves equal sort order matches deterministically")]
    public void Relation_suggestion_analyzer_resolves_equal_sort_order_matches_deterministically()
    {
        TrackRelationParserRule laterAliasRule = CreateRule("versionOf", alias: "radio edit", sortOrder: 10);
        TrackRelationParserRule laterTypeRule = CreateRule("remixOf", alias: "Radio Edit", sortOrder: 10);
        TrackRelationParserRule expectedRule = CreateRule("editOf", alias: "Radio Edit", sortOrder: 10);
        TrackRelationParserRule[] rules = [laterAliasRule, laterTypeRule, expectedRule];

        TrackRelationParserRule? result = RelationSuggestionAnalyzer.MatchRule("Radio Edit", rules);

        Assert.Same(expectedRule, result);
    }

    private static TrackRelationParserRule CreateRule(string alias, int sortOrder, bool isActive = true)
    {
        return CreateRule("editOf", alias, sortOrder, isActive);
    }

    private static TrackRelationParserRule CreateRule(
        string relationTypeCode,
        string alias,
        int sortOrder,
        bool isActive = true)
    {
        return TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            relationTypeCode,
            alias,
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            confidence: 90,
            TrackRelationParserRuleDirection.VariantToBase,
            sortOrder,
            isActive,
            isBuiltin: false);
    }

    private static object AudioFile(string rootPath, string filePath, string title, int trackNumber)
    {
        return new
        {
            filePath,
            relativePath = Path.GetRelativePath(rootPath, filePath),
            format = "flac",
            sizeBytes = 4,
            lastModifiedAt = DateTimeOffset.UtcNow,
            contentHash = (string?)null,
            audioMetadata = new
            {
                title,
                artists = Array.Empty<string>(),
                albumTitle = (string?)null,
                albumArtists = Array.Empty<string>(),
                catalogNumber = (string?)null,
                releaseDate = (string?)null,
                year = (int?)null,
                durationSeconds = (int?)null,
                trackNumber
            },
            coverArtifact = (object?)null
        };
    }

    private static JsonElement FindTrackByTitle(JsonElement session, string title)
    {
        return session.GetProperty("drafts")
            .EnumerateArray()
            .SelectMany(draft => draft.GetProperty("tracks").EnumerateArray())
            .Single(track => track.GetProperty("title").GetString() == title);
    }

    private static async Task CreateDictionaryEntryAsync(HttpClient client, string code, string name)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/settings/dictionaries",
            new { kind = "trackRelationType", code, name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static async Task CreateParserRuleAsync(HttpClient client, string relationTypeCode, string alias, string direction)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/settings/track-relation-parser-rules",
            new
            {
                relationTypeCode,
                alias,
                matchMode = "exactLastParentheticalToken",
                confidence = 90,
                direction,
                sortOrder = 5,
                isActive = true
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        Stream stream = await response.Content.ReadAsStreamAsync();
        return await JsonDocument.ParseAsync(stream);
    }

    private sealed class TempImportRoot : IDisposable
    {
        private TempImportRoot(string path)
        {
            Path = path;
        }

        public string Path { get; }

        public static TempImportRoot Create()
        {
            return new TempImportRoot(Directory.CreateTempSubdirectory("discweave-import-relation-suggestion-test-").FullName);
        }

        public void Dispose()
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, recursive: true);
            }
        }
    }
}
