using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportReviewDeduplicationTests
{
    [Fact(DisplayName = "Confirmation preflight for new import reports creates without mutating catalog data")]
    public async Task Confirmation_preflight_for_new_import_reports_creates_without_mutating_catalog_data()
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
        await AssertCatalogCountsAsync(client, host, releases: 0, tracks: 0, ownedItems: 0, localFiles: 0, fileLinks: 0);

        using JsonDocument preflight = await PreflightOnlyDraftAsync(client, scan);

        Assert.Equal("newRelease", preflight.RootElement.GetProperty("outcome").GetString());
        Assert.True(preflight.RootElement.GetProperty("canConfirm").GetBoolean());
        JsonElement summary = preflight.RootElement.GetProperty("summary");
        Assert.Equal(1, summary.GetProperty("includedTrackCount").GetInt32());
        Assert.Equal(0, summary.GetProperty("skippedTrackCount").GetInt32());
        Assert.Equal(1, summary.GetProperty("newReleases").GetInt32());
        Assert.Equal(1, summary.GetProperty("newTracks").GetInt32());
        Assert.Equal(1, summary.GetProperty("newDigitalOwnedItems").GetInt32());
        Assert.Equal(1, summary.GetProperty("newLocalAudioFiles").GetInt32());
        Assert.Equal(1, summary.GetProperty("newDigitalTrackFileLinks").GetInt32());
        await AssertCatalogCountsAsync(client, host, releases: 0, tracks: 0, ownedItems: 0, localFiles: 0, fileLinks: 0);
    }

    [Fact(DisplayName = "Confirmation preflight for moved hash duplicate reports relink without mutating catalog data")]
    public async Task Confirmation_preflight_for_moved_hash_duplicate_reports_relink_without_mutating_catalog_data()
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
        await AssertCatalogCountsAsync(client, host, releases: 1, tracks: 1, ownedItems: 1, localFiles: 1, fileLinks: 1);

        using JsonDocument duplicateScan = await PostScanAsync(
            client,
            "/music/moved",
            AudioFile(
                "/music/moved",
                "/music/moved/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash));
        JsonElement duplicateTrack = duplicateScan.RootElement.GetProperty("drafts")[0].GetProperty("tracks")[0];
        Assert.Equal(existingTrackId, duplicateTrack.GetProperty("selectedTrackId").GetGuid());

        using JsonDocument preflight = await PreflightOnlyDraftAsync(client, duplicateScan);

        Assert.Equal("exactDuplicate", preflight.RootElement.GetProperty("outcome").GetString());
        JsonElement summary = preflight.RootElement.GetProperty("summary");
        Assert.Equal(1, summary.GetProperty("reusedReleases").GetInt32());
        Assert.Equal(1, summary.GetProperty("reusedTracks").GetInt32());
        Assert.Equal(1, summary.GetProperty("reusedDigitalOwnedItems").GetInt32());
        Assert.Equal(1, summary.GetProperty("newLocalAudioFiles").GetInt32());
        Assert.Equal(1, summary.GetProperty("relinkedDigitalTrackFileLinks").GetInt32());
        Assert.Contains(
            preflight.RootElement.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.duplicate_file");
        await AssertCatalogCountsAsync(client, host, releases: 1, tracks: 1, ownedItems: 1, localFiles: 1, fileLinks: 1);
    }

    [Fact(DisplayName = "Confirmation preflight for partial duplicate reports release update without mutating catalog data")]
    public async Task Confirmation_preflight_for_partial_duplicate_reports_release_update_without_mutating_catalog_data()
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

        using JsonDocument expandedScan = await PostScanAsync(
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
        JsonElement tracks = expandedScan.RootElement.GetProperty("drafts")[0].GetProperty("tracks");
        Assert.Equal(existingTrackId, tracks[0].GetProperty("selectedTrackId").GetGuid());
        Assert.Equal(JsonValueKind.Null, tracks[1].GetProperty("selectedTrackId").ValueKind);
        await AssertCatalogCountsAsync(client, host, releases: 1, tracks: 1, ownedItems: 1, localFiles: 1, fileLinks: 1);

        using JsonDocument preflight = await PreflightOnlyDraftAsync(client, expandedScan);

        Assert.Equal("partialDuplicate", preflight.RootElement.GetProperty("outcome").GetString());
        JsonElement summary = preflight.RootElement.GetProperty("summary");
        Assert.Equal(1, summary.GetProperty("updatedReleases").GetInt32());
        Assert.Equal(1, summary.GetProperty("reusedTracks").GetInt32());
        Assert.Equal(1, summary.GetProperty("newTracks").GetInt32());
        Assert.Equal(2, summary.GetProperty("newLocalAudioFiles").GetInt32());
        Assert.Equal(2, summary.GetProperty("newDigitalTrackFileLinks").GetInt32());
        await AssertCatalogCountsAsync(client, host, releases: 1, tracks: 1, ownedItems: 1, localFiles: 1, fileLinks: 1);
    }

    [Fact(DisplayName = "Confirmation preflight reports skipped tracks and all-skipped blocking errors without mutating catalog data")]
    public async Task Confirmation_preflight_reports_skipped_tracks_and_all_skipped_blocking_errors_without_mutating_catalog_data()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument scan = await PostScanAsync(
            client,
            "/music/source",
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/01 Begins.flac",
                BeginsContentHash),
            AudioFile(
                "/music/source",
                "/music/source/[AA 01, 2016] Steven Julien - Fallen/02 Blue Truth.flac",
                BlueTruthContentHash));

        using JsonDocument partialPreflight = await PreflightOnlyDraftAsync(
            client,
            scan,
            (track, index) => TrackUpdatePayload(track, isSkipped: index == 1));
        JsonElement partialSummary = partialPreflight.RootElement.GetProperty("summary");
        Assert.True(partialPreflight.RootElement.GetProperty("canConfirm").GetBoolean());
        Assert.Equal(1, partialSummary.GetProperty("includedTrackCount").GetInt32());
        Assert.Equal(1, partialSummary.GetProperty("skippedTrackCount").GetInt32());
        Assert.Contains(
            partialPreflight.RootElement.GetProperty("tracks").EnumerateArray(),
            track =>
                track.GetProperty("isSkipped").GetBoolean() &&
                track.GetProperty("trackAction").GetString() == "skip" &&
                track.GetProperty("localFileAction").GetString() == "skip" &&
                track.GetProperty("fileLinkAction").GetString() == "skip");

        using JsonDocument blockedPreflight = await PreflightOnlyDraftAsync(
            client,
            scan,
            (track, _) => TrackUpdatePayload(track, isSkipped: true));
        Assert.False(blockedPreflight.RootElement.GetProperty("canConfirm").GetBoolean());
        Assert.Equal("blocked", blockedPreflight.RootElement.GetProperty("outcome").GetString());
        Assert.Contains(
            blockedPreflight.RootElement.GetProperty("blockingErrors").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "release_import.tracks_required");
        await AssertCatalogCountsAsync(client, host, releases: 0, tracks: 0, ownedItems: 0, localFiles: 0, fileLinks: 0);
    }

    private static async Task<JsonDocument> PreflightOnlyDraftAsync(
        HttpClient client,
        JsonDocument scan,
        Func<JsonElement, int, object>? trackPayload = null)
    {
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight",
            DraftUpdatePayload(scan, trackPayload));
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        return JsonDocument.Parse(document.RootElement.GetRawText());
    }

    private static object DraftUpdatePayload(
        JsonDocument scan,
        Func<JsonElement, int, object>? trackPayload)
    {
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        return new
        {
            title = draft.GetProperty("title").GetString(),
            type = draft.GetProperty("type").GetString(),
            catalogNumber = draft.GetProperty("catalogNumber").ValueKind == JsonValueKind.Null ? null : draft.GetProperty("catalogNumber").GetString(),
            labelName = draft.GetProperty("labelName").ValueKind == JsonValueKind.Null ? null : draft.GetProperty("labelName").GetString(),
            releaseDate = draft.GetProperty("releaseDate").ValueKind == JsonValueKind.Null ? null : draft.GetProperty("releaseDate").GetString(),
            year = draft.GetProperty("year").ValueKind == JsonValueKind.Null ? (int?)null : draft.GetProperty("year").GetInt32(),
            isVariousArtists = draft.GetProperty("isVariousArtists").GetBoolean(),
            notOnLabel = draft.GetProperty("notOnLabel").GetBoolean(),
            artistNames = draft.GetProperty("artistNames").EnumerateArray().Select(value => value.GetString()).ToArray(),
            artistCredits = Array.Empty<object>(),
            labels = Array.Empty<object>(),
            selectedArtistIds = Array.Empty<Guid>(),
            genres = draft.GetProperty("genres").EnumerateArray().Select(value => value.GetString()).ToArray(),
            tags = draft.GetProperty("tags").EnumerateArray().Select(value => value.GetString()).ToArray(),
            coverPath = draft.GetProperty("coverPath").ValueKind == JsonValueKind.Null ? null : draft.GetProperty("coverPath").GetString(),
            tracks = draft.GetProperty("tracks")
                .EnumerateArray()
                .Select((track, index) => trackPayload?.Invoke(track, index) ?? TrackUpdatePayload(track, track.GetProperty("isSkipped").GetBoolean()))
                .ToArray()
        };
    }

    private static object TrackUpdatePayload(JsonElement track, bool isSkipped)
    {
        return new
        {
            id = track.GetProperty("id").GetGuid(),
            position = track.GetProperty("position").ValueKind == JsonValueKind.Null ? (int?)null : track.GetProperty("position").GetInt32(),
            disc = track.GetProperty("disc").ValueKind == JsonValueKind.Null ? null : track.GetProperty("disc").GetString(),
            side = track.GetProperty("side").ValueKind == JsonValueKind.Null ? null : track.GetProperty("side").GetString(),
            title = track.GetProperty("title").GetString(),
            durationSeconds = track.GetProperty("durationSeconds").ValueKind == JsonValueKind.Null ? (int?)null : track.GetProperty("durationSeconds").GetInt32(),
            artistNames = track.GetProperty("artistNames").EnumerateArray().Select(value => value.GetString()).ToArray(),
            artistCredits = Array.Empty<object>(),
            inheritReleaseArtistCredits = track.GetProperty("inheritReleaseArtistCredits").GetBoolean(),
            selectedArtistIds = Array.Empty<Guid>(),
            selectedTrackId = track.GetProperty("selectedTrackId").ValueKind == JsonValueKind.Null ? (Guid?)null : track.GetProperty("selectedTrackId").GetGuid(),
            isSkipped
        };
    }

    private static async Task AssertCatalogCountsAsync(
        HttpClient client,
        ApiTestHost host,
        int releases,
        int tracks,
        int ownedItems,
        int localFiles,
        int fileLinks)
    {
        await AssertListTotalAsync(client, "/api/releases?limit=10&offset=0", releases);
        await AssertListTotalAsync(client, "/api/tracks?limit=10&offset=0", tracks);
        await AssertListTotalAsync(client, "/api/owned-items?limit=10&offset=0", ownedItems);
        Assert.Equal(localFiles, (await host.LocalAudioFilesAsync()).Length);
        Assert.Equal(fileLinks, (await host.DigitalTrackFileLinksAsync()).Length);
    }
}
