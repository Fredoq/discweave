using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Fact(DisplayName = "Review Workbench duplicate candidates require matching known main artists")]
    public async Task Review_workbench_duplicate_candidates_require_matching_known_main_artists()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid first = await CreateAttributedTrackAsync(client, "Shared Title", "First Artist");
        Guid other = await CreateAttributedTrackAsync(client, "Shared Title", "Other Artist");
        _ = await CreateAttributedTrackAsync(client, "Shared Title", null);
        Guid release = await CreateAttributedReleaseAsync(client, "Shared Album", "First Artist");
        Guid otherRelease = await CreateAttributedReleaseAsync(client, "Shared Album", "Other Artist");
        using JsonDocument before = await GetJsonAsync(client, "/api/review-workbench/items?category=duplicateCandidates&limit=100", HttpStatusCode.OK);
        Assert.Empty(before.RootElement.GetProperty("items").EnumerateArray());

        Guid duplicate = await CreateAttributedTrackAsync(client, "Shared Title", "First Artist");
        Guid duplicateRelease = await CreateAttributedReleaseAsync(client, "Shared Album", "First Artist");
        using JsonDocument after = await GetJsonAsync(client, "/api/review-workbench/items?category=duplicateCandidates&limit=100", HttpStatusCode.OK);
        JsonElement[] items = [.. after.RootElement.GetProperty("items").EnumerateArray()];
        JsonElement tracks = Assert.Single(items, item => item.GetProperty("subtype").GetString() == "duplicateTracks");
        JsonElement releases = Assert.Single(items, item => item.GetProperty("subtype").GetString() == "duplicateReleases");
        Assert.Equal(new[] { first, duplicate }.Order(), TargetIds(tracks).Order());
        Assert.Equal(new[] { release, duplicateRelease }.Order(), TargetIds(releases).Order());
        Assert.DoesNotContain(other, TargetIds(tracks));
        Assert.DoesNotContain(otherRelease, TargetIds(releases));
    }

    [Fact(DisplayName = "An unrelated artist does not reset duplicate candidate triage")]
    public async Task An_unrelated_artist_does_not_reset_duplicate_candidate_triage()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateAttributedTrackAsync(client, "Stable Duplicate", "First Artist");
        _ = await CreateAttributedTrackAsync(client, "Stable Duplicate", "First Artist");
        using JsonDocument refresh = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        string stableKey = await FirstStableKeyAsync(client, "duplicateCandidates");
        using JsonDocument dismissed = await SendJsonAsync(client.PatchAsJsonAsync($"/api/review-workbench/items/{stableKey}/state", new { state = "dismissed", note = "Distinct recordings" }), HttpStatusCode.OK);
        _ = await CreateAttributedTrackAsync(client, "Stable Duplicate", "Other Artist");
        using JsonDocument refreshed = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items?category=duplicateCandidates&state=dismissed", HttpStatusCode.OK);
        JsonElement item = Assert.Single(list.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal(stableKey, item.GetProperty("stableKey").GetString());
        Assert.Equal("dismissed", item.GetProperty("state").GetString());
        using JsonDocument open = await GetJsonAsync(client, "/api/review-workbench/items?category=duplicateCandidates&state=open", HttpStatusCode.OK);
        Assert.Empty(open.RootElement.GetProperty("items").EnumerateArray());
    }

    [Theory(DisplayName = "Review Workbench copy gaps reflect current possession rather than wishlist or sold records")]
    [InlineData("wanted", false)]
    [InlineData("sold", false)]
    [InlineData("owned", true)]
    [InlineData("needsDigitization", true)]
    public async Task Review_workbench_copy_gaps_reflect_current_possession(string status, bool possessed)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid physicalRelease = await CreateReleaseWithTwoTracksAsync(client, "Physical Status");
        Guid digitalRelease = await CreateReleaseWithTwoTracksAsync(client, "Digital Status");
        Guid physical = await CreateOwnedItemAsync(client, "release", physicalRelease, status, new { type = "vinyl" });
        Guid digital = await CreateOwnedItemAsync(client, "release", digitalRelease, status, new { type = "digital" });
        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items?limit=100", HttpStatusCode.OK);
        JsonElement[] items = [.. list.RootElement.GetProperty("items").EnumerateArray()];
        Assert.Equal(possessed, HasSignal(items, "ownedItemsMissingCondition", physical));
        Assert.Equal(possessed, HasSignal(items, "ownedItemsMissingStorageLocation", physical));
        Assert.Equal(possessed, HasSignal(items, "digitalCopiesMissingLinkedFiles", digital));
        Assert.Equal(possessed, HasSignal(items, "physicalWithoutDigital", physicalRelease));
    }

    [Theory(DisplayName = "Only possessed digital copies cover a possessed physical copy")]
    [InlineData("wanted", true)]
    [InlineData("sold", true)]
    [InlineData("owned", false)]
    [InlineData("needsDigitization", false)]
    public async Task Only_possessed_digital_copies_cover_a_possessed_physical_copy(string digitalStatus, bool hasGap)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid release = await CreateReleaseAsync(client, "Coverage Status");
        _ = await CreateOwnedItemAsync(client, "release", release, "needsDigitization", new { type = "vinyl" });
        _ = await CreateOwnedItemAsync(client, "release", release, digitalStatus, new { type = "digital" });
        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items?category=formatGaps&limit=100", HttpStatusCode.OK);
        JsonElement[] items = [.. list.RootElement.GetProperty("items").EnumerateArray()];
        Assert.Equal(hasGap, HasSignal(items, "physicalWithoutDigital", release));
        Assert.False(HasSignal(items, "wantedNotOwned", release));
    }

    [Fact(DisplayName = "Relation gap suggestions require one compatible base and stop after an expected relation exists")]
    public async Task Relation_gap_suggestions_require_one_compatible_base_and_stop_after_an_expected_relation_exists()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid variant = await CreateAttributedTrackAsync(client, "Ceremony (Club Mix)", "First Artist");
        _ = await CreateAttributedTrackAsync(client, "Ceremony", "Other Artist");
        using JsonDocument unrelated = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps", HttpStatusCode.OK);
        Assert.Empty(unrelated.RootElement.GetProperty("items").EnumerateArray());
        Guid original = await CreateAttributedTrackAsync(client, "Ceremony", "First Artist");
        using JsonDocument unique = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps", HttpStatusCode.OK);
        _ = Assert.Single(unique.RootElement.GetProperty("items").EnumerateArray());
        _ = await CreateAttributedTrackAsync(client, "Ceremony", "First Artist");
        using JsonDocument ambiguous = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps", HttpStatusCode.OK);
        Assert.Empty(ambiguous.RootElement.GetProperty("items").EnumerateArray());
        using JsonDocument relation = await SendJsonAsync(client.PostAsJsonAsync("/api/track-relations", new { sourceTrackId = variant, targetTrackId = original, type = "remixOf" }), HttpStatusCode.Created);
        using JsonDocument linked = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps", HttpStatusCode.OK);
        Assert.Empty(linked.RootElement.GetProperty("items").EnumerateArray());
    }

    [Theory(DisplayName = "M4A quality signals require a known codec or explicit quality")]
    [InlineData(null, null, false)]
    [InlineData("alac", null, false)]
    [InlineData("aac", null, true)]
    [InlineData("aac", "lossless", false)]
    [InlineData(null, "lossy", true)]
    public async Task M4a_quality_signals_require_a_known_codec_or_explicit_quality(string? codec, string? quality, bool hasGap)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid release = await CreateReleaseWithTwoTracksAsync(client, "Unknown M4A Quality");
        Guid item = await CreateOwnedItemAsync(client, "release", release, "owned", new { type = "digital" });
        _ = await host.SeedDigitalTrackFileLinkAsync(release, item, 1, "/music/unknown.m4a", "m4a", new string('a', 64), codec, quality);
        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items?category=formatGaps", HttpStatusCode.OK);
        Assert.Equal(hasGap, list.RootElement.GetProperty("items").EnumerateArray().Any(signal => signal.GetProperty("subtype").GetString() == "lossyWithoutLossless"));
    }

    [Theory(DisplayName = "Confirmed import relation gaps remain visible unless their exact suggestion was rejected")]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Confirmed_import_relation_gaps_remain_visible_unless_their_exact_suggestion_was_rejected(bool reject)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        const string root = "/music/rejection-control";
        const string folder = root + "/[DW 03, 2026] Import Artist - Rejection Control";
        using JsonDocument scan = await PostDesktopScanAsync(client, root,
            DesktopAudioFile(root, folder + "/01 Control.flac", "Control", 1, new string('1', 64)),
            DesktopAudioFile(root, folder + "/02 Control Radio.flac", "Control (Radio Edit)", 2, new string('2', 64)));
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement suggestion = Assert.Single(scan.RootElement.GetProperty("relationSuggestions").EnumerateArray());
        Guid suggestionId = suggestion.GetProperty("id").GetGuid();
        Assert.Equal("pending", suggestion.GetProperty("decision").GetString());
        if (reject)
        {
            using JsonDocument decision = await SendJsonAsync(client.PutAsJsonAsync(
                $"/api/imports/{sessionId}/relation-suggestions/{suggestionId}",
                new { decision = "rejected", reviewed = (object?)null }), HttpStatusCode.OK);
            Assert.Equal("rejected", Assert.Single(decision.RootElement.GetProperty("relationSuggestions").EnumerateArray()).GetProperty("decision").GetString());
        }

        await ConfirmOnlyDraftAsync(client, scan);
        using JsonDocument gaps = await GetJsonAsync(client, "/api/review-workbench/items?category=relationGaps&limit=100", HttpStatusCode.OK);
        JsonElement[] items = [.. gaps.RootElement.GetProperty("items").EnumerateArray()];
        if (reject)
        {
            Assert.Empty(items);
        }
        else
        {
            JsonElement item = Assert.Single(items);
            Assert.Equal("variantTitleWithoutRelation", item.GetProperty("subtype").GetString());
            Assert.Contains(item.GetProperty("targets").EnumerateArray(), target => target.GetProperty("title").GetString() == "Control (Radio Edit)");
            Assert.Contains(item.GetProperty("targets").EnumerateArray(), target => target.GetProperty("title").GetString() == "Control");
        }
    }

    private static IEnumerable<Guid> TargetIds(JsonElement item)
    {
        return item.GetProperty("targets").EnumerateArray().Select(target => target.GetProperty("id").GetGuid());
    }

    private static bool HasSignal(IEnumerable<JsonElement> items, string subtype, Guid targetId)
    {
        return items.Any(item => item.GetProperty("subtype").GetString() == subtype && TargetIds(item).Contains(targetId));
    }

    private static async Task<Guid> CreateAttributedTrackAsync(HttpClient client, string title, string? artist)
    {
        object[] credits = artist is null ? [] : [new { name = artist, role = "mainArtist" }];
        using JsonDocument track = await SendJsonAsync(client.PostAsJsonAsync("/api/tracks", new
        {
            title,
            credits
        }), HttpStatusCode.Created);
        return track.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateAttributedReleaseAsync(HttpClient client, string title, string artist)
    {
        using JsonDocument release = await SendJsonAsync(client.PostAsJsonAsync("/api/releases", new
        {
            title,
            type = "album",
            artistCredits = new[] { new { name = artist, role = "mainArtist" } }
        }), HttpStatusCode.Created);
        return release.RootElement.GetProperty("id").GetGuid();
    }
}
