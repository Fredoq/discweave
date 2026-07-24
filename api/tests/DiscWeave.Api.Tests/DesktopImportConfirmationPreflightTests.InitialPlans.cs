using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportReviewDeduplicationTests
{
    [Fact(DisplayName = "Confirmation preflight blocks an invalid accepted Required relation without mutating catalog data")]
    public async Task Confirmation_preflight_blocks_an_invalid_accepted_Required_relation_without_mutating_catalog_data()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        const string rootPath = "/music/required-preflight";
        using JsonDocument scan = await PostScanAsync(
            client,
            rootPath,
            AudioFile(
                rootPath,
                $"{rootPath}/[FAC 73, 1983] New Order - Blue Monday/01 Blue Monday.flac",
                contentHash: null),
            AudioFile(
                rootPath,
                $"{rootPath}/[FAC 73, 1983] New Order - Blue Monday/02 Blue Monday (Radio Edit).flac",
                contentHash: null));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement suggestion = Assert.Single(scan.RootElement.GetProperty("relationSuggestions").EnumerateArray());
        Guid suggestionId = suggestion.GetProperty("id").GetGuid();
        Guid sourceDraftTrackId = suggestion.GetProperty("reviewed").GetProperty("source").GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
            new
            {
                decision = "accepted",
                reviewed = new
                {
                    source = new { kind = "draftTrack", id = sourceDraftTrackId },
                    target = new { kind = "draftTrack", id = sourceDraftTrackId },
                    relationTypeCode = "versionOf"
                }
            });
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        await host.ExecuteSqlAsync(
            "UPDATE release_import_relation_suggestions SET application_mode = 'Required';");

        using JsonDocument preflight = await PreflightOnlyDraftAsync(client, scan);

        Assert.False(preflight.RootElement.GetProperty("canConfirm").GetBoolean());
        Assert.Equal("blocked", preflight.RootElement.GetProperty("outcome").GetString());
        Assert.Contains(
            preflight.RootElement.GetProperty("blockingErrors").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "track_relation.stack_self_relation");
        await AssertCatalogCountsAsync(client, host, releases: 0, tracks: 0, ownedItems: 0, localFiles: 0, fileLinks: 0);
    }

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

    [Fact(DisplayName = "External metadata reaches preflight without file or ownership plans")]
    public async Task External_metadata_reaches_preflight_without_file_or_ownership_plans()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid sessionId, Guid draftId, Guid draftTrackId) = await host.SeedExternalMetadataReleaseImportAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirmation-preflight",
            ExternalMetadataDraftPayload(draftTrackId, coverPath: null));
        using JsonDocument preflight = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(preflight.RootElement.GetProperty("canConfirm").GetBoolean());
        JsonElement summary = preflight.RootElement.GetProperty("summary");
        Assert.Equal(1, summary.GetProperty("newReleases").GetInt32());
        Assert.Equal(1, summary.GetProperty("newTracks").GetInt32());
        Assert.Equal(0, summary.GetProperty("newDigitalOwnedItems").GetInt32());
        Assert.Equal(0, summary.GetProperty("reusedDigitalOwnedItems").GetInt32());
        Assert.Equal(0, summary.GetProperty("newLocalAudioFiles").GetInt32());
        Assert.Equal(0, summary.GetProperty("updatedLocalAudioFiles").GetInt32());
        Assert.Equal(0, summary.GetProperty("newDigitalTrackFileLinks").GetInt32());
        Assert.Equal(0, summary.GetProperty("relinkedDigitalTrackFileLinks").GetInt32());
        Assert.Equal(0, summary.GetProperty("unchangedDigitalTrackFileLinks").GetInt32());
        JsonElement trackPlan = Assert.Single(preflight.RootElement.GetProperty("tracks").EnumerateArray());
        Assert.Equal("skip", trackPlan.GetProperty("localFileAction").GetString());
        Assert.Equal("skip", trackPlan.GetProperty("fileLinkAction").GetString());
        Assert.DoesNotContain(
            preflight.RootElement.GetProperty("actions").EnumerateArray(),
            action => action.GetProperty("kind").GetString() is "digitalOwnedItem" or "localAudioFile" or "digitalTrackFileLink");
        await AssertCatalogCountsAsync(client, host, releases: 0, tracks: 0, ownedItems: 0, localFiles: 0, fileLinks: 0);
    }

    [Fact(DisplayName = "External metadata confirmation ignores a persisted local cover path")]
    public async Task External_metadata_confirmation_ignores_a_persisted_local_cover_path()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid sessionId, Guid draftId, Guid draftTrackId) = await host.SeedExternalMetadataReleaseImportAsync();
        DirectoryInfo directory = Directory.CreateTempSubdirectory("discweave-external-cover-");
        string coverPath = Path.Combine(directory.FullName, "caller-controlled-cover.jpg");

        try
        {
            await File.WriteAllTextAsync(coverPath, "must not be read as an ExternalMetadata cover");
            using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
                $"/api/imports/{sessionId}/drafts/{draftId}",
                ExternalMetadataDraftPayload(draftTrackId, coverPath));
            Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);

            using HttpResponseMessage confirmResponse = await client.PostAsync(
                $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
                content: null);
            using JsonDocument confirmation = await ReadJsonAsync(confirmResponse);
            Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
            Assert.Equal("confirmed", confirmation.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());

            using HttpResponseMessage releasesResponse = await client.GetAsync(
                "/api/releases?search=Blue%20Monday&limit=10&offset=0");
            using JsonDocument releases = await ReadJsonAsync(releasesResponse);
            Assert.Equal(HttpStatusCode.OK, releasesResponse.StatusCode);
            JsonElement release = Assert.Single(releases.RootElement.GetProperty("items").EnumerateArray());
            Assert.Equal(JsonValueKind.Null, release.GetProperty("coverImage").ValueKind);
            await AssertCatalogCountsAsync(client, host, releases: 1, tracks: 1, ownedItems: 0, localFiles: 0, fileLinks: 0);
        }
        finally
        {
            directory.Delete(recursive: true);
        }
    }

    private static object ExternalMetadataDraftPayload(Guid draftTrackId, string? coverPath)
    {
        return new
        {
            title = "Blue Monday",
            type = "single",
            catalogNumber = "FAC 73",
            labelName = "Factory",
            releaseDate = "1983-03-07",
            year = (int?)1983,
            isVariousArtists = false,
            notOnLabel = false,
            artistNames = NewOrderArtistNames,
            artistCredits = Array.Empty<object>(),
            labels = Array.Empty<object>(),
            selectedArtistIds = Array.Empty<Guid>(),
            genres = ElectronicGenres,
            tags = Array.Empty<string>(),
            externalSources = Array.Empty<object>(),
            createCatalogTracks = true,
            coverPath,
            tracks = new[]
            {
                new
                {
                    id = draftTrackId,
                    position = (int?)1,
                    disc = (string?)null,
                    side = "A",
                    title = "Blue Monday",
                    versionYear = (int?)1983,
                    durationSeconds = (int?)449,
                    artistNames = NewOrderArtistNames,
                    artistCredits = Array.Empty<object>(),
                    inheritReleaseArtistCredits = false,
                    selectedArtistIds = Array.Empty<Guid>(),
                    trackMode = "create",
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                }
            }
        };
    }
}
