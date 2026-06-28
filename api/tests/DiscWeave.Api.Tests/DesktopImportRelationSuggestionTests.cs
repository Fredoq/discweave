using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests : IClassFixture<SqliteFixture>
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
                diagnostics = Array.Empty<object>(),
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
        Assert.Equal("versionOf", suggestion.GetProperty("suggested").GetProperty("relationTypeCode").GetString());
        Assert.Equal("versionOf", suggestion.GetProperty("reviewed").GetProperty("relationTypeCode").GetString());
        Assert.Equal("draftTrack", suggestion.GetProperty("reviewed").GetProperty("source").GetProperty("kind").GetString());
        Assert.Equal(radioEditTrack.GetProperty("id").GetGuid(), suggestion.GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid());
        Assert.Equal("draftTrack", suggestion.GetProperty("reviewed").GetProperty("target").GetProperty("kind").GetString());
        Assert.Equal(breakTrack.GetProperty("id").GetGuid(), suggestion.GetProperty("reviewed").GetProperty("target").GetProperty("id").GetGuid());
        JsonElement targetOption = Assert.Single(suggestion.GetProperty("targetOptions").EnumerateArray());
        Assert.Equal("draftTrack", targetOption.GetProperty("kind").GetString());
        Assert.Equal(breakTrack.GetProperty("id").GetGuid(), targetOption.GetProperty("id").GetGuid());
    }

    [Fact(DisplayName = "Desktop scan does not suggest draft targets from another draft")]
    public async Task Desktop_scan_does_not_suggest_draft_targets_from_another_draft()
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
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(root.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 1)
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(0, document.RootElement.GetProperty("relationSuggestions").GetArrayLength());
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
        string radioEditTrackPath = Path.Combine(firstReleaseDirectory, "02 Radio Edit.flac");
        string crossDraftTrackPath = Path.Combine(secondReleaseDirectory, "01 Other.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        await File.WriteAllTextAsync(crossDraftTrackPath, "flac");
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
                    AudioFile(root.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2),
                    AudioFile(root.Path, crossDraftTrackPath, "Other Track", trackNumber: 1)
                }
            });
        using JsonDocument scanDocument = await ReadJsonAsync(scanResponse);
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement radioEditTrack = FindTrackByTitle(scanDocument.RootElement, "It's Like That (Radio Edit)");
        JsonElement crossDraftTrack = FindTrackByTitle(scanDocument.RootElement, "Other Track");
        JsonElement suggestion = Assert.Single(scanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray());
        Guid suggestionId = suggestion.GetProperty("id").GetGuid();
        Assert.DoesNotContain(
            suggestion.GetProperty("targetOptions").EnumerateArray(),
            option => option.GetProperty("id").GetGuid() == crossDraftTrack.GetProperty("id").GetGuid());

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "draftTrack", id = radioEditTrack.GetProperty("id").GetGuid() },
                    target = new { kind = "draftTrack", id = crossDraftTrack.GetProperty("id").GetGuid() },
                    relationTypeCode = "versionOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Equal("release_import_relation_suggestion.draft_track_not_found", updateDocument.RootElement.GetProperty("code").GetString());
    }

}
