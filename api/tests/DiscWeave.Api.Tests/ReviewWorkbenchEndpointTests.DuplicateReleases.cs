using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Theory(DisplayName = "Release duplicate candidates need matching titles and real catalog numbers on the same label")]
    [InlineData("Shared Album", "Shared Label", null, false)]
    [InlineData("Shared Album", "Shared Label", "", false)]
    [InlineData("Shared Album", "Shared Label", "N/A", false)]
    [InlineData("Shared Album", "Shared Label", "CAT-002", false)]
    [InlineData("Shared Album", "Other Label", "CAT-001", false)]
    [InlineData("Other Album", "Shared Label", "CAT-001", false)]
    [InlineData("Shared Album (Deluxe)", "Shared Label", "CAT-001", false)]
    [InlineData(" shared   ALBUM ", "Shared Label", " cat-001 ", true)]
    public async Task Release_duplicate_candidates_need_matching_titles_and_real_catalog_numbers_on_the_same_label(
        string title, string label, string? catalog, bool expected)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid first = await CreateDuplicateReviewReleaseAsync(client);
        Guid second = await CreateDuplicateReviewReleaseAsync(client, title: title, label: label, catalog: catalog);
        JsonElement[] items = await DuplicateReleaseItemsAsync(client);
        Assert.Equal(expected ? 1 : 0, items.Length);
        if (expected)
        {
            Assert.Equal(new[] { first, second }.Order(), TargetIds(items[0]).Order());
            Assert.StartsWith("Possible duplicate release:", items[0].GetProperty("title").GetString(), StringComparison.Ordinal);
            Assert.All(items[0].GetProperty("targets").EnumerateArray(), target =>
                Assert.Contains("Matching title, main artist and catalog number: Shared Label / CAT-001", target.GetProperty("subtitle").GetString(), StringComparison.Ordinal));
        }
    }

    [Theory(DisplayName = "Matching missing or placeholder catalog numbers are not duplicate evidence")]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("none")]
    [InlineData("N/A")]
    [InlineData("unknown")]
    [InlineData("-")]
    public async Task Matching_missing_or_placeholder_catalog_numbers_are_not_duplicate_evidence(string? catalog)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateDuplicateReviewReleaseAsync(client, catalog: catalog);
        _ = await CreateDuplicateReviewReleaseAsync(client, catalog: catalog);
        Assert.Empty(await DuplicateReleaseItemsAsync(client));
    }

    [Theory(DisplayName = "Matching release titles and catalogs do not override edition contradictions")]
    [InlineData(2000, null, "album", false)]
    [InlineData(2001, "2001-06-02", "album", false)]
    [InlineData(2001, null, "ep", false)]
    [InlineData(2000, "2001-06-01", "album", false)]
    [InlineData(null, null, "unknown", true)]
    [InlineData(2001, null, "album", true)]
    [InlineData(2001, "2001-06-01", "album", true)]
    public async Task Matching_release_titles_and_catalogs_do_not_override_edition_contradictions(
        int? year, string? date, string type, bool expected)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateDuplicateReviewReleaseAsync(client, year: 2001, date: "2001-06-01");
        _ = await CreateDuplicateReviewReleaseAsync(client, year: year, date: date, type: type);
        Assert.Equal(expected ? 1 : 0, (await DuplicateReleaseItemsAsync(client)).Length);
    }

    [Theory(DisplayName = "Release duplicate candidates reject conflicting main artists and Various Artists")]
    [InlineData("Other Artist", false)]
    [InlineData("Shared Artist", true)]
    [InlineData(null, true)]
    public async Task Release_duplicate_candidates_reject_conflicting_main_artists_and_various_artists(string? artist, bool various)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateDuplicateReviewReleaseAsync(client);
        _ = await CreateDuplicateReviewReleaseAsync(client, artist: artist, various: various);
        Assert.Empty(await DuplicateReleaseItemsAsync(client));
    }

    [Theory(DisplayName = "Release duplicate candidates respect provider edition identifiers")]
    [InlineData("release", "102", false)]
    [InlineData("release", "101", true)]
    [InlineData("master", "102", true)]
    public async Task Release_duplicate_candidates_respect_provider_edition_identifiers(string resourceType, string secondId, bool expected)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid first = await CreateDuplicateReviewReleaseAsync(client);
        Guid second = await CreateDuplicateReviewReleaseAsync(client);
        await host.SetReviewReleaseSourceAsync(first, "release", "101");
        await host.SetReviewReleaseSourceAsync(second, resourceType, secondId);
        Assert.Equal(expected ? 1 : 0, (await DuplicateReleaseItemsAsync(client)).Length);
    }

    [Theory(DisplayName = "Ambiguous provider editions are not duplicate evidence even when some identifiers overlap")]
    [InlineData("101|102", "101")]
    [InlineData("101", "101|102")]
    [InlineData("101|102", "101|102")]
    [InlineData("101|102", "")]
    [InlineData("", "101|102")]
    public async Task Ambiguous_provider_editions_are_not_duplicate_evidence_even_when_some_identifiers_overlap(string left, string right)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid first = await CreateDuplicateReviewReleaseAsync(client);
        Guid second = await CreateDuplicateReviewReleaseAsync(client);
        await host.SetReviewReleaseSourceAsync(first, "release", left.Split('|', StringSplitOptions.RemoveEmptyEntries));
        await host.SetReviewReleaseSourceAsync(second, "release", right.Split('|', StringSplitOptions.RemoveEmptyEntries));
        Assert.Empty(await DuplicateReleaseItemsAsync(client));
    }

    [Fact(DisplayName = "Incomplete release metadata cannot bridge conflicting editions into one duplicate group")]
    public async Task Incomplete_release_metadata_cannot_bridge_conflicting_editions_into_one_duplicate_group()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid original = await CreateDuplicateReviewReleaseAsync(client, year: 2001);
        Guid incomplete = await CreateDuplicateReviewReleaseAsync(client);
        Guid reissue = await CreateDuplicateReviewReleaseAsync(client, year: 2010);
        JsonElement[] items = await DuplicateReleaseItemsAsync(client);
        Assert.Equal(2, items.Length);
        Assert.All(items, item =>
        {
            Assert.Equal(2, TargetIds(item).Count());
            Assert.Contains(incomplete, TargetIds(item));
            Assert.False(TargetIds(item).Contains(original) && TargetIds(item).Contains(reissue));
        });
    }

    [Theory(DisplayName = "Several shared labels produce one stable release group and retain its triage")]
    [InlineData("dismissed")]
    [InlineData("resolved")]
    public async Task Several_shared_labels_produce_one_stable_release_group_and_retain_its_triage(string status)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid[] releases = [await CreateDuplicateReviewReleaseAsync(client, coLabel: true),
            await CreateDuplicateReviewReleaseAsync(client, coLabel: true),
            await CreateDuplicateReviewReleaseAsync(client, coLabel: true)];
        string key = await host.SeedLegacyReleaseDuplicateAsync(releases, "Shared Album", status);
        using JsonDocument refresh = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        Assert.Empty(await DuplicateReleaseItemsAsync(client));
        JsonElement item = Assert.Single(await DuplicateReleaseItemsAsync(client, status));
        Assert.Equal(key, item.GetProperty("stableKey").GetString());
        Assert.Equal("Possible duplicate release: Shared Album", item.GetProperty("title").GetString());
        Assert.Equal(releases.Order(), TargetIds(item).Order());
    }

    [Theory(DisplayName = "Refresh retires title-only release alerts without deleting user triage history")]
    [InlineData("open", "resolved", "resolvedBySystem")]
    [InlineData("reopened", "resolved", "resolvedBySystem")]
    [InlineData("dismissed", "dismissed", "dismissedByUser")]
    [InlineData("resolved", "resolved", "resolvedByUser")]
    public async Task Refresh_retires_title_only_release_alerts_without_deleting_user_triage_history(string previous, string expected, string reason)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid[] releases = [await CreateDuplicateReviewReleaseAsync(client, catalog: null), await CreateDuplicateReviewReleaseAsync(client, catalog: null)];
        string key = await host.SeedLegacyReleaseDuplicateAsync(releases, "Shared Album", previous);
        using JsonDocument refresh = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        Assert.Empty(await DuplicateReleaseItemsAsync(client));
        JsonElement item = Assert.Single(await DuplicateReleaseItemsAsync(client, expected));
        Assert.Equal(key, item.GetProperty("stableKey").GetString());
        Assert.Equal(reason, item.GetProperty("reason").GetString());
        Assert.Equal(releases.Order(), TargetIds(item).Order());
        Assert.Equal(previous == "open" ? string.Empty : "Keep my release decision", await host.ReviewIssueNoteAsync(key));
    }

    [Fact(DisplayName = "Release duplicate candidates stay inside their collection")]
    public async Task Release_duplicate_candidates_stay_inside_their_collection()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient owner, HttpClient other) = await CreateAuthenticatedClientsAsync(host);
        _ = await CreateDuplicateReviewReleaseAsync(owner);
        _ = await CreateDuplicateReviewReleaseAsync(other);
        Assert.Empty(await DuplicateReleaseItemsAsync(owner));
        Assert.Empty(await DuplicateReleaseItemsAsync(other));
        _ = await CreateDuplicateReviewReleaseAsync(owner);
        _ = Assert.Single(await DuplicateReleaseItemsAsync(owner));
        Assert.Empty(await DuplicateReleaseItemsAsync(other));
    }

    private static async Task<JsonElement[]> DuplicateReleaseItemsAsync(HttpClient client, string state = "active")
    {
        using JsonDocument list = await GetJsonAsync(client, $"/api/review-workbench/items?category=duplicateCandidates&state={state}&limit=100", HttpStatusCode.OK);
        return [.. list.RootElement.GetProperty("items").EnumerateArray()
            .Where(item => item.GetProperty("subtype").GetString() == "duplicateReleases").Select(item => item.Clone())];
    }

    private static async Task<Guid> CreateDuplicateReviewReleaseAsync(
        HttpClient client,
        string title = "Shared Album",
        string label = "Shared Label",
        string? catalog = "CAT-001",
        string? artist = "Shared Artist",
        bool various = false,
        int? year = null,
        string? date = null,
        string type = "album",
        bool coLabel = false)
    {
        object[] labels = catalog == "" ? [] : [new { name = label, catalogNumber = catalog, hasNoCatalogNumber = catalog is null }];
        if (coLabel)
        {
            labels = [.. labels, new { name = "Co-release Label", catalogNumber = "CO-01", hasNoCatalogNumber = false }];
        }

        using JsonDocument release = await SendJsonAsync(client.PostAsJsonAsync("/api/releases", new
        {
            title,
            type,
            year,
            releaseDate = date,
            isVariousArtists = various,
            artistCredits = artist is null ? [] : new[] { new { name = artist, role = "mainArtist" } },
            labels
        }), HttpStatusCode.Created);
        return release.RootElement.GetProperty("id").GetGuid();
    }
}
