using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Fact(DisplayName = "Review Workbench surfaces release-owned local file quality and mapping signals")]
    public async Task Review_workbench_surfaces_release_owned_local_file_quality_and_mapping_signals()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseWithTwoTracksAsync(client, "Digital File Workbench Release");
        Guid digitalOwnedItemId = await CreateOwnedItemAsync(
            client,
            "release",
            releaseId,
            "owned",
            new { type = "digital" });
        _ = await host.SeedDigitalTrackFileLinkAsync(
            releaseId,
            digitalOwnedItemId,
            1,
            "/music/workbench/digital-file-workbench-release/01 Linked.mp3",
            "mp3",
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        _ = await host.SeedLocalAudioFileAsync(
            "/music/workbench/duplicates/first.flac",
            "flac",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        _ = await host.SeedLocalAudioFileAsync(
            "/music/workbench/duplicates/second.flac",
            "flac",
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        _ = await host.SeedLocalAudioFileWithoutFormatAsync(
            "/music/workbench/unformatted/unknown-audio",
            "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc");

        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items?state=open&limit=100", HttpStatusCode.OK);
        JsonElement items = list.RootElement.GetProperty("items");

        AssertContainsSubtype(items, "duplicateCandidates", "duplicateDigitalFileIdentities");
        AssertContainsSubtype(items, "missingMetadata", "digitalCopiesMissingLinkedFiles");
        AssertContainsSubtype(items, "missingMetadata", "localAudioFilesMissingCodec");
        AssertContainsSubtype(items, "missingMetadata", "localAudioFilesMissingFormat");
        AssertContainsSubtype(items, "formatGaps", "lossyWithoutLossless");
        AssertContainsSubtype(items, "importCleanup", "localAudioFilesUnmapped");
    }

    [Fact(DisplayName = "Review Workbench suggests missing track relations from variant titles and resolves them after relation creation")]
    public async Task Review_workbench_suggests_missing_track_relations_from_variant_titles_and_resolves_them_after_relation_creation()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid baseTrackId = await CreateTrackAsync(client, "Ceremony");
        Guid variantTrackId = await CreateTrackAsync(client, "Ceremony (Club Mix)");

        using JsonDocument before = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps&state=open&limit=50", HttpStatusCode.OK);
        JsonElement beforeItem = Assert.Single(
            before.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("subtype").GetString() == "variantTitleWithoutRelation");

        using JsonDocument relation = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/track-relations",
                new { sourceTrackId = variantTrackId, targetTrackId = baseTrackId, type = "remixOf" }),
            HttpStatusCode.Created);
        using JsonDocument after = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps&state=open&limit=50", HttpStatusCode.OK);

        Assert.Contains(
            beforeItem.GetProperty("targets").EnumerateArray(),
            target => target.GetProperty("id").GetGuid() == variantTrackId &&
                target.GetProperty("subtitle").GetString() == "Variant token: Club Mix");
        Assert.Equal("remixOf", relation.RootElement.GetProperty("type").GetString());
        Assert.DoesNotContain(
            after.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("targets").EnumerateArray().Any(target => target.GetProperty("id").GetGuid() == variantTrackId));
    }

    [Fact(DisplayName = "Review Workbench surfaces confirmed import cleanup warnings duplicate outcomes and skipped relation suggestions")]
    public async Task Review_workbench_surfaces_confirmed_import_cleanup_warnings_duplicate_outcomes_and_skipped_relation_suggestions()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument warningScan = await PostDesktopScanAsync(
            client,
            "/music/import-warning",
            DesktopAudioFile(
                "/music/import-warning",
                "/music/import-warning/Loose Folder/01 Pattern Failure.flac",
                "Pattern Failure",
                1,
                "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"));
        await ConfirmOnlyDraftAsync(client, warningScan);

        const string duplicateHash = "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        using JsonDocument firstDuplicateScan = await PostDesktopScanAsync(
            client,
            "/music/import-duplicate-original",
            DesktopAudioFile(
                "/music/import-duplicate-original",
                "/music/import-duplicate-original/[DW 01, 2026] Import Artist - Duplicate Source/01 Duplicate.flac",
                "Duplicate",
                1,
                duplicateHash));
        await ConfirmOnlyDraftAsync(client, firstDuplicateScan);
        using JsonDocument duplicateScan = await PostDesktopScanAsync(
            client,
            "/music/import-duplicate-next",
            DesktopAudioFile(
                "/music/import-duplicate-next",
                "/music/import-duplicate-next/[DW 01, 2026] Import Artist - Duplicate Source/01 Duplicate.flac",
                "Duplicate",
                1,
                duplicateHash));
        await ConfirmOnlyDraftAsync(client, duplicateScan);

        using JsonDocument relationScan = await PostDesktopScanAsync(
            client,
            "/music/import-relation",
            DesktopAudioFile(
                "/music/import-relation",
                "/music/import-relation/[DW 02, 2026] Import Artist - Relation Cleanup/01 Base.flac",
                "Base",
                1,
                "f111111111111111111111111111111111111111111111111111111111111111"),
            DesktopAudioFile(
                "/music/import-relation",
                "/music/import-relation/[DW 02, 2026] Import Artist - Relation Cleanup/02 Base Radio.flac",
                "Base (Radio Edit)",
                2,
                "f222222222222222222222222222222222222222222222222222222222222222"));
        Guid relationSessionId = relationScan.RootElement.GetProperty("id").GetGuid();
        Guid relationDraftId = relationScan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        Guid suggestionId = Assert.Single(relationScan.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("id").GetGuid();
        using JsonDocument rejectedSuggestion = await SendJsonAsync(
            client.PutAsJsonAsync(
                $"/api/imports/{relationSessionId}/relation-suggestions/{suggestionId}",
                new { decision = "rejected", reviewed = (object?)null }),
            HttpStatusCode.OK);
        using JsonDocument confirmedRelationDraft = await SendJsonAsync(
            client.PostAsync($"/api/imports/{relationSessionId}/drafts/{relationDraftId}/confirm", content: null),
            HttpStatusCode.OK);

        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items?category=importCleanup&state=open&limit=100", HttpStatusCode.OK);
        JsonElement items = list.RootElement.GetProperty("items");

        Assert.Equal("rejected", Assert.Single(rejectedSuggestion.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("decision").GetString());
        Assert.Equal("confirmed", confirmedRelationDraft.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
        AssertContainsSubtype(items, "importCleanup", "confirmedImportWarnings");
        AssertContainsSubtype(items, "importCleanup", "duplicateImportOutcomes");
        AssertContainsSubtype(items, "importCleanup", "skippedRelationSuggestions");
    }

    private static async Task<Guid> CreateReleaseWithTwoTracksAsync(HttpClient client, string title)
    {
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/releases",
                new
                {
                    title,
                    type = "album",
                    year = 2026,
                    isVariousArtists = false,
                    artistCredits = new[] { new { name = "Workbench Artist", role = "mainArtist" } },
                    genres = Array.Empty<string>(),
                    tags = Array.Empty<string>(),
                    tracklist = new object[]
                    {
                        new { title = "Linked Track", position = 1, durationSeconds = 180 },
                        new { title = "Missing Linked File", position = 2, durationSeconds = 181 }
                    }
                }),
            HttpStatusCode.Created);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateTrackAsync(HttpClient client, string title)
    {
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/tracks",
                new { title, genres = Array.Empty<string>(), tags = Array.Empty<string>() }),
            HttpStatusCode.Created);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> PostDesktopScanAsync(HttpClient client, string rootPath, params object[] files)
    {
        return await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/imports/desktop-folder-scans",
                new
                {
                    sourceRoot = rootPath,
                    ignoredFileCount = 0,
                    files
                }),
            HttpStatusCode.Created);
    }

    private static object DesktopAudioFile(
        string rootPath,
        string filePath,
        string title,
        int trackNumber,
        string contentHash)
    {
        return new
        {
            filePath,
            relativePath = Path.GetRelativePath(rootPath, filePath),
            format = "flac",
            sizeBytes = 9L,
            lastModifiedAt = DateTimeOffset.Parse("2026-01-02T03:04:05Z", null, System.Globalization.DateTimeStyles.RoundtripKind),
            contentHash,
            audioMetadata = new
            {
                title,
                artists = Array.Empty<string>(),
                albumTitle = (string?)null,
                albumArtists = new[] { "Import Artist" },
                catalogNumber = (string?)null,
                releaseDate = "2026",
                year = (int?)2026,
                durationSeconds = (int?)null,
                trackNumber
            },
            coverArtifact = (object?)null
        };
    }

    private static async Task ConfirmOnlyDraftAsync(HttpClient client, JsonDocument scan)
    {
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        Guid draftId = scan.RootElement.GetProperty("drafts")[0].GetProperty("id").GetGuid();
        using JsonDocument confirmation = await SendJsonAsync(
            client.PostAsync($"/api/imports/{sessionId}/drafts/{draftId}/confirm", content: null),
            HttpStatusCode.OK);
        Assert.Equal("confirmed", confirmation.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());
    }

    private static void AssertContainsSubtype(JsonElement items, string category, string subtype)
    {
        Assert.Contains(items.EnumerateArray(), item =>
            item.GetProperty("category").GetString() == category &&
            item.GetProperty("subtype").GetString() == subtype);
    }
}
