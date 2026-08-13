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
}
