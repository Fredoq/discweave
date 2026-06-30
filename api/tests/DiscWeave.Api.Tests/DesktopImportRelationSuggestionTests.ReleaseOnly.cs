using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "Relation suggestions reject release-only draft tracks")]
    public async Task Relation_suggestions_reject_release_only_draft_tracks()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 72, 2026] Run-DMC - Release Only Relation");
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
        Guid baseDraftTrackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();
        Guid radioEditDraftTrackId = draft.GetProperty("tracks")[1].GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(scanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();

        using HttpResponseMessage draftUpdateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReleaseOnlyRelationDraftUpdate(baseDraftTrackId, radioEditDraftTrackId));
        Assert.Equal(HttpStatusCode.OK, draftUpdateResponse.StatusCode);

        using HttpResponseMessage detailResponse = await client.GetAsync($"/api/imports/{sessionId}");
        using JsonDocument detailDocument = await ReadJsonAsync(detailResponse);
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        JsonElement detailSuggestion = Assert.Single(detailDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray());
        Assert.DoesNotContain(
            detailSuggestion.GetProperty("targetOptions").EnumerateArray(),
            option => option.GetProperty("kind").GetString() == "draftTrack" &&
                option.GetProperty("id").GetGuid() == baseDraftTrackId);

        using HttpResponseMessage suggestionUpdateResponse = await client.PutAsJsonAsync(
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
        using JsonDocument suggestionUpdateDocument = await ReadJsonAsync(suggestionUpdateResponse);
        Assert.Equal(HttpStatusCode.BadRequest, suggestionUpdateResponse.StatusCode);
        Assert.Equal("release_import_relation.release_only", suggestionUpdateDocument.RootElement.GetProperty("code").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync("/api/track-relations?type=versionOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        JsonElement confirmedDraft = confirmDocument.RootElement.GetProperty("drafts")[0];
        Assert.Equal("confirmed", confirmedDraft.GetProperty("status").GetString());
        Assert.DoesNotContain(
            confirmedDraft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import_relation.release_only");
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.Equal(0, relationsDocument.RootElement.GetProperty("total").GetInt32());
    }

    private static object ReleaseOnlyRelationDraftUpdate(Guid baseDraftTrackId, Guid radioEditDraftTrackId)
    {
        return new
        {
            title = "Release Only Relation",
            type = "single",
            catalogNumber = "DW 72",
            labelName = (string?)null,
            releaseDate = (string?)null,
            year = 2026,
            isVariousArtists = true,
            notOnLabel = true,
            createCatalogTracks = true,
            coverPath = (string?)null,
            artistNames = Array.Empty<string>(),
            artistCredits = Array.Empty<object>(),
            labels = Array.Empty<object>(),
            selectedArtistIds = Array.Empty<Guid>(),
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>(),
            externalSources = Array.Empty<object>(),
            tracks = new object[]
            {
                new
                {
                    id = baseDraftTrackId,
                    trackMode = "releaseOnly",
                    position = 1,
                    disc = (string?)null,
                    side = (string?)null,
                    title = "It's Like That",
                    durationSeconds = (int?)null,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    inheritReleaseArtistCredits = false,
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                },
                new
                {
                    id = radioEditDraftTrackId,
                    trackMode = "create",
                    position = 2,
                    disc = (string?)null,
                    side = (string?)null,
                    title = "It's Like That (Radio Edit)",
                    durationSeconds = (int?)null,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    inheritReleaseArtistCredits = false,
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                }
            }
        };
    }
}
