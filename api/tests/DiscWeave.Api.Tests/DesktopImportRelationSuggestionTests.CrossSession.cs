using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Theory(DisplayName = "Relation suggestion updates reject cross session draft sources and targets")]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Relation_suggestion_updates_reject_cross_session_draft_sources_and_targets(
        bool crossSessionEndpointIsSource)
    {
        using var owningRoot = TempImportRoot.Create();
        string owningReleaseDirectory = Path.Combine(owningRoot.Path, "[DW 30, 1998] Run-DMC - Owning Session");
        _ = Directory.CreateDirectory(owningReleaseDirectory);
        string baseTrackPath = Path.Combine(owningReleaseDirectory, "01 Base.flac");
        string radioEditTrackPath = Path.Combine(owningReleaseDirectory, "02 Radio Edit.flac");
        await File.WriteAllTextAsync(baseTrackPath, "flac");
        await File.WriteAllTextAsync(radioEditTrackPath, "flac");
        using var foreignRoot = TempImportRoot.Create();
        string foreignReleaseDirectory = Path.Combine(foreignRoot.Path, "[DW 31, 1999] Run-DMC - Foreign Session");
        _ = Directory.CreateDirectory(foreignReleaseDirectory);
        string foreignTrackPath = Path.Combine(foreignReleaseDirectory, "01 Foreign.flac");
        await File.WriteAllTextAsync(foreignTrackPath, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage owningScanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = owningRoot.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(owningRoot.Path, baseTrackPath, "It's Like That", trackNumber: 1),
                    AudioFile(owningRoot.Path, radioEditTrackPath, "It's Like That (Radio Edit)", trackNumber: 2)
                }
            });
        using JsonDocument owningScanDocument = await ReadJsonAsync(owningScanResponse);
        Assert.Equal(HttpStatusCode.Created, owningScanResponse.StatusCode);
        Guid sessionId = owningScanDocument.RootElement.GetProperty("id").GetGuid();
        Guid sourceDraftTrackId = FindTrackByTitle(
            owningScanDocument.RootElement,
            "It's Like That (Radio Edit)").GetProperty("id").GetGuid();
        Guid targetDraftTrackId = FindTrackByTitle(
            owningScanDocument.RootElement,
            "It's Like That").GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(
                owningScanDocument.RootElement.GetProperty("relationSuggestions").EnumerateArray())
            .GetProperty("id")
            .GetGuid();

        using HttpResponseMessage foreignScanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = foreignRoot.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(foreignRoot.Path, foreignTrackPath, "Foreign Track", trackNumber: 1)
                }
            });
        using JsonDocument foreignScanDocument = await ReadJsonAsync(foreignScanResponse);
        Assert.Equal(HttpStatusCode.Created, foreignScanResponse.StatusCode);
        Guid crossSessionDraftTrackId = FindTrackByTitle(
            foreignScanDocument.RootElement,
            "Foreign Track").GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "pending",
                reviewed = new
                {
                    source = new
                    {
                        kind = "draftTrack",
                        id = crossSessionEndpointIsSource ? crossSessionDraftTrackId : sourceDraftTrackId
                    },
                    target = new
                    {
                        kind = "draftTrack",
                        id = crossSessionEndpointIsSource ? targetDraftTrackId : crossSessionDraftTrackId
                    },
                    relationTypeCode = "versionOf"
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Equal(
            "release_import_relation_suggestion.draft_track_not_found",
            updateDocument.RootElement.GetProperty("code").GetString());
    }
}
