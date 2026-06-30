using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportTrackCreationControlsTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Import review can mix release-only rows with linked catalog tracks")]
    public async Task Import_review_can_mix_release_only_rows_with_linked_catalog_tracks()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 71, 2026] DJ Example - Room Mix");
        _ = Directory.CreateDirectory(releaseDirectory);
        string introPath = Path.Combine(releaseDirectory, "01 Intro.flac");
        string linkedPath = Path.Combine(releaseDirectory, "02 Known Theme.flac");
        await File.WriteAllTextAsync(introPath, "intro");
        await File.WriteAllTextAsync(linkedPath, "known");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid linkedTrackId = await CreateTrackAsync(client, "Known Theme");

        using JsonDocument scanDocument = await PostScanAsync(client, root.Path, introPath, linkedPath);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scanDocument.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        JsonElement[] draftTracks = [.. draft.GetProperty("tracks").EnumerateArray()];
        Guid introDraftTrackId = draftTracks[0].GetProperty("id").GetGuid();
        Guid linkedDraftTrackId = draftTracks[1].GetProperty("id").GetGuid();

        Assert.True(draft.GetProperty("createCatalogTracks").GetBoolean());
        Assert.All(draftTracks, track => Assert.Equal("create", track.GetProperty("trackMode").GetString()));

        object reviewPayload = DraftUpdatePayload(
            createCatalogTracks: false,
            introDraftTrackId,
            linkedDraftTrackId,
            linkedTrackId);
        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            reviewPayload);
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        JsonElement updatedDraft = updateDocument.RootElement.GetProperty("drafts")[0];
        Assert.False(updatedDraft.GetProperty("createCatalogTracks").GetBoolean());
        Assert.Equal("releaseOnly", updatedDraft.GetProperty("tracks")[0].GetProperty("trackMode").GetString());
        Assert.Equal("link", updatedDraft.GetProperty("tracks")[1].GetProperty("trackMode").GetString());

        using HttpResponseMessage preflightResponse = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight",
            reviewPayload);
        using JsonDocument preflightDocument = await ReadJsonAsync(preflightResponse);
        Assert.Equal(HttpStatusCode.OK, preflightResponse.StatusCode);
        JsonElement summary = preflightDocument.RootElement.GetProperty("summary");
        Assert.Equal(2, summary.GetProperty("includedTrackCount").GetInt32());
        Assert.Equal(0, summary.GetProperty("newTracks").GetInt32());
        Assert.Equal(1, summary.GetProperty("reusedTracks").GetInt32());
        Assert.Equal(1, summary.GetProperty("releaseOnlyTracks").GetInt32());
        Assert.Equal("releaseOnly", preflightDocument.RootElement.GetProperty("tracks")[0].GetProperty("trackAction").GetString());
        Assert.Equal("reuse", preflightDocument.RootElement.GetProperty("tracks")[1].GetProperty("trackAction").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());

        using HttpResponseMessage releasesResponse = await client.GetAsync("/api/releases?search=Room%20Mix&limit=10&offset=0");
        using JsonDocument releasesDocument = await ReadJsonAsync(releasesResponse);
        using HttpResponseMessage introTracksResponse = await client.GetAsync("/api/tracks?search=Set%20intro&limit=10&offset=0");
        using JsonDocument introTracksDocument = await ReadJsonAsync(introTracksResponse);
        using HttpResponseMessage linkedTracksResponse = await client.GetAsync("/api/tracks?search=Known%20Theme&limit=10&offset=0");
        using JsonDocument linkedTracksDocument = await ReadJsonAsync(linkedTracksResponse);

        JsonElement release = Assert.Single(releasesDocument.RootElement.GetProperty("items").EnumerateArray());
        JsonElement tracklist = release.GetProperty("tracklist");
        Assert.True(tracklist[0].GetProperty("isReleaseOnly").GetBoolean());
        Assert.Equal(JsonValueKind.Null, tracklist[0].GetProperty("trackId").ValueKind);
        Assert.Equal("Set intro", tracklist[0].GetProperty("title").GetString());
        Assert.NotEmpty(tracklist[0].GetProperty("linkedLocalFiles").EnumerateArray());
        Assert.False(tracklist[1].GetProperty("isReleaseOnly").GetBoolean());
        Assert.Equal(linkedTrackId, tracklist[1].GetProperty("trackId").GetGuid());
        Assert.NotEmpty(tracklist[1].GetProperty("linkedLocalFiles").EnumerateArray());
        Assert.Equal(0, introTracksDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(1, linkedTracksDocument.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Import confirmation links multiple release-only rows without parsed track numbers")]
    public async Task Import_confirmation_links_multiple_release_only_rows_without_parsed_track_numbers()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[DW 71, 2026] DJ Example - Unnumbered Set");
        _ = Directory.CreateDirectory(releaseDirectory);
        string firstPath = Path.Combine(releaseDirectory, "Warmup.flac");
        string secondPath = Path.Combine(releaseDirectory, "Peak.flac");
        await File.WriteAllTextAsync(firstPath, "warmup");
        await File.WriteAllTextAsync(secondPath, "peak");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scanDocument = await PostScanAsync(
            client,
            root.Path,
            [
                AudioFile(root.Path, firstPath, "Warmup", trackNumber: null),
                AudioFile(root.Path, secondPath, "Peak", trackNumber: null)
            ]);
        Guid sessionId = scanDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scanDocument.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        JsonElement[] draftTracks = [.. draft.GetProperty("tracks").EnumerateArray()];
        Guid firstDraftTrackId = draftTracks[0].GetProperty("id").GetGuid();
        Guid secondDraftTrackId = draftTracks[1].GetProperty("id").GetGuid();

        object reviewPayload = ReleaseOnlyDraftUpdatePayload(
            "Unnumbered Set",
            createCatalogTracks: false,
            [
                ReleaseOnlyTrackUpdate(firstDraftTrackId, "Warmup", position: null),
                ReleaseOnlyTrackUpdate(secondDraftTrackId, "Peak", position: null)
            ]);
        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            reviewPayload);
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

        using HttpResponseMessage confirmResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", null);
        using JsonDocument confirmDocument = await ReadJsonAsync(confirmResponse);
        using HttpResponseMessage releasesResponse = await client.GetAsync("/api/releases?search=Unnumbered%20Set&limit=10&offset=0");
        using JsonDocument releasesDocument = await ReadJsonAsync(releasesResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirmDocument.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        JsonElement release = Assert.Single(releasesDocument.RootElement.GetProperty("items").EnumerateArray());
        JsonElement tracklist = release.GetProperty("tracklist");
        Assert.Equal(2, tracklist.GetArrayLength());
        Assert.All(tracklist.EnumerateArray(), track =>
        {
            Assert.True(track.GetProperty("isReleaseOnly").GetBoolean());
            Assert.NotEmpty(track.GetProperty("linkedLocalFiles").EnumerateArray());
        });
    }

}
