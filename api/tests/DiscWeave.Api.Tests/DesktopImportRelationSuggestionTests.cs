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
