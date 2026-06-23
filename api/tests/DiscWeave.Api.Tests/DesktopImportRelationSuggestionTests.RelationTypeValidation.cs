using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "Confirmed drafts skip accepted relation suggestions whose type was deactivated")]
    public async Task Confirmed_drafts_skip_accepted_relation_suggestions_whose_type_was_deactivated()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 27, 1998] Run-DMC - Inactive Relation Type");
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
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        await DeactivateTrackRelationTypeAsync(client, "editOf");

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", content: null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync("/api/track-relations?type=editOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        JsonElement confirmedDraft = confirmDocument.RootElement.GetProperty("drafts")[0];
        Assert.Equal("confirmed", confirmedDraft.GetProperty("status").GetString());
        Assert.Contains(
            confirmedDraft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import_relation.relation_type_inactive");
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.Equal(0, relationsDocument.RootElement.GetProperty("total").GetInt32());
    }
}
