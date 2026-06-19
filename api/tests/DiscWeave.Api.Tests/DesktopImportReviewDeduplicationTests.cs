using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportReviewDeduplicationTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public DesktopImportReviewDeduplicationTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Confirming the final open desktop import draft completes the session")]
    public async Task Confirming_the_final_open_desktop_import_draft_completes_the_session()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scan = await PostScanAsync(
            client,
            "/music/source",
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));

        using JsonDocument confirmation = await ConfirmOnlyDraftAsync(client, scan);

        Assert.Equal("completed", confirmation.RootElement.GetProperty("status").GetString());
        Assert.Equal("confirmed", confirmation.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
    }

    [Fact(DisplayName = "Skipping the final open desktop import draft completes the session")]
    public async Task Skipping_the_final_open_desktop_import_draft_completes_the_session()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scan = await PostScanAsync(
            client,
            "/music/source",
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage skipResponse = await client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/skip", null);
        using JsonDocument skip = await ReadJsonAsync(skipResponse);

        Assert.Equal(HttpStatusCode.OK, skipResponse.StatusCode);
        Assert.Equal("completed", skip.RootElement.GetProperty("status").GetString());
        Assert.Equal("skipped", skip.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
    }

    [Fact(DisplayName = "Desktop import uses file fingerprint to preselect duplicate files when hash is missing")]
    public async Task Desktop_import_uses_file_fingerprint_to_preselect_duplicate_files_when_hash_is_missing()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument firstScan = await PostScanAsync(
            client,
            "/music/source",
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                contentHash: null));
        using JsonDocument firstConfirmation = await ConfirmOnlyDraftAsync(client, firstScan);
        Guid existingTrackId = await SingleTrackIdAsync(client, "Begins");

        using JsonDocument duplicateScan = await PostScanAsync(
            client,
            "/music/source",
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                contentHash: null));
        JsonElement duplicateTrack = duplicateScan.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];

        Assert.Equal(existingTrackId, duplicateTrack.GetProperty("selectedTrackId").GetGuid());
        Assert.Contains(
            duplicateTrack.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
    }

    [Fact(DisplayName = "Desktop import draft update rejects selected tracks outside the authenticated collection")]
    public async Task Desktop_import_draft_update_rejects_selected_tracks_outside_the_authenticated_collection()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient adminClient, HttpClient userClient) = await CreateAuthenticatedClientsAsync(host);
        using JsonDocument adminScan = await PostScanAsync(
            adminClient,
            "/music/admin",
            AudioFile(
                "/music/admin",
                "/music/admin/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));
        using JsonDocument adminConfirmation = await ConfirmOnlyDraftAsync(adminClient, adminScan);
        Guid adminTrackId = await SingleTrackIdAsync(adminClient, "Begins");
        using JsonDocument userScan = await PostScanAsync(
            userClient,
            "/music/user",
            AudioFile(
                "/music/user",
                "/music/user/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));
        Guid userSessionId = userScan.RootElement.GetProperty("id").GetGuid();
        Guid userDraftId = userScan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await userClient.PutAsJsonAsync(
            $"/api/imports/{userSessionId}/drafts/{userDraftId}",
            DraftUpdatePayload(userScan, adminTrackId));
        using JsonDocument update = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Equal("release_import.selected_track_not_found", update.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Partial duplicate desktop import reuses the matching release and adds missing tracks")]
    public async Task Partial_duplicate_desktop_import_reuses_the_matching_release_and_adds_missing_tracks()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument firstScan = await PostScanAsync(
            client,
            "/music/source",
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));
        using JsonDocument firstConfirmation = await ConfirmOnlyDraftAsync(client, firstScan);
        Guid existingTrackId = await SingleTrackIdAsync(client, "Begins");

        using JsonDocument duplicateScan = await PostScanAsync(
            client,
            "/music/expanded",
            AudioFile(
                "/music/expanded",
                "/music/expanded/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash),
            AudioFile(
                "/music/expanded",
                "/music/expanded/[AA 01, 2016] Steven Julien - Fallen/02 Blue Truth.flac",
                BlueTruthContentHash));
        JsonElement duplicateTracks = duplicateScan.RootElement.GetProperty("drafts")[0].GetProperty("tracks");

        Assert.Equal(existingTrackId, duplicateTracks[0].GetProperty("selectedTrackId").GetGuid());
        Assert.Equal(JsonValueKind.Null, duplicateTracks[1].GetProperty("selectedTrackId").ValueKind);

        using JsonDocument duplicateConfirmation = await ConfirmOnlyDraftAsync(client, duplicateScan);

        using HttpResponseMessage releaseResponse = await client.GetAsync("/api/releases?search=Fallen&limit=10&offset=0");
        using JsonDocument releaseDocument = await ReadJsonAsync(releaseResponse);
        JsonElement release = releaseDocument.RootElement
            .GetProperty("items")
            .EnumerateArray()
            .Single(item => item.GetProperty("tracklist").GetArrayLength() == 2);
        JsonElement tracklist = release.GetProperty("tracklist");

        Assert.Equal(HttpStatusCode.OK, releaseResponse.StatusCode);
        Assert.Equal(1, releaseDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(2, tracklist.GetArrayLength());
        Assert.Equal("Begins", tracklist[0].GetProperty("title").GetString());
        Assert.Equal("Blue Truth", tracklist[1].GetProperty("title").GetString());
        Assert.Equal(existingTrackId, tracklist[0].GetProperty("trackId").GetGuid());
        await AssertListTotalAsync(client, "/api/tracks?search=Begins&limit=10&offset=0", 1);
        await AssertListTotalAsync(client, "/api/tracks?search=Blue%20Truth&limit=10&offset=0", 1);
        await AssertListTotalAsync(client, "/api/owned-items?limit=10&offset=0", 1);
        Assert.Equal(3, (await host.LocalAudioFilesAsync()).Length);
        Assert.Equal(2, (await host.DigitalTrackFileLinksAsync()).Length);
    }

    [Fact(DisplayName = "Exact duplicate desktop import restores missing release ownership")]
    public async Task Exact_duplicate_desktop_import_restores_missing_release_ownership()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument firstScan = await PostScanAsync(
            client,
            "/music/source",
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));
        using JsonDocument firstConfirmation = await ConfirmOnlyDraftAsync(client, firstScan);
        await DeleteReleaseOwnedItemAsync(client);
        await AssertListTotalAsync(client, "/api/owned-items?limit=10&offset=0", 0);

        using JsonDocument duplicateScan = await PostScanAsync(
            client,
            "/music/duplicate",
            AudioFile(
                "/music/duplicate",
                "/music/duplicate/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));
        using JsonDocument duplicateConfirmation = await ConfirmOnlyDraftAsync(client, duplicateScan);

        await AssertListTotalAsync(client, "/api/releases?search=Fallen&limit=10&offset=0", 2);
        await AssertListTotalAsync(client, "/api/tracks?search=Begins&limit=10&offset=0", 2);
        await AssertListTotalAsync(client, "/api/owned-items?limit=10&offset=0", 1);
    }

    [Fact(DisplayName = "Manual matched existing release import stores file identity for future duplicate scans")]
    public async Task Manual_matched_existing_release_import_stores_file_identity_for_future_duplicate_scans()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument firstScan = await PostScanAsync(
            client,
            "/music/source",
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));
        using JsonDocument firstConfirmation = await ConfirmOnlyDraftAsync(client, firstScan);
        Guid existingTrackId = await SingleTrackIdAsync(client, "Begins");

        using JsonDocument matchedScan = await PostScanAsync(
            client,
            "/music/remastered",
            AudioFile(
                "/music/remastered",
                "/music/remastered/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BlueTruthContentHash));
        Guid sessionId = matchedScan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = matchedScan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            DraftUpdatePayload(matchedScan, existingTrackId));
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        using JsonDocument matchedConfirmation = await ConfirmOnlyDraftAsync(client, matchedScan);

        using JsonDocument movedScan = await PostScanAsync(
            client,
            "/music/moved",
            AudioFile(
                "/music/moved",
                "/music/moved/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BlueTruthContentHash));
        JsonElement movedTrack = movedScan.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];

        Assert.Equal(existingTrackId, movedTrack.GetProperty("selectedTrackId").GetGuid());
        Assert.Contains(
            movedTrack.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
    }

}
