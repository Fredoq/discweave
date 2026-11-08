using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Theory(DisplayName = "A full catalog release date removes stale import notices while preserving triage history")]
    [InlineData(false)]
    [InlineData(true)]
    public async Task A_full_catalog_release_date_removes_stale_import_notices_while_preserving_triage_history(bool dismissed)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await host.SeedConfirmedImportNoticeAsync(
            "import.release_date_partial", "Release date has unknown month or day");
        using JsonDocument initialRefresh = await SendJsonAsync(
            client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        using JsonDocument before = await GetJsonAsync(client,
            "/api/review-workbench/items?category=importCleanup&state=open", HttpStatusCode.OK);
        JsonElement notice = Assert.Single(before.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("title").GetString()!.Contains("exact release date", StringComparison.Ordinal));
        string stableKey = notice.GetProperty("stableKey").GetString()!;
        Assert.Contains("keep year-only precision", notice.GetProperty("title").GetString(), StringComparison.Ordinal);
        if (dismissed)
        {
            using JsonDocument decision = await SendJsonAsync(client.PatchAsJsonAsync(
                $"/api/review-workbench/items/{stableKey}/state", new { state = "dismissed" }), HttpStatusCode.OK);
        }

        using JsonDocument saved = await SendJsonAsync(client.PutAsJsonAsync($"/api/releases/{releaseId}",
            new { title = "Imported release", type = "unknown", year = 2022, releaseDate = "2022-07-15", isVariousArtists = true }), HttpStatusCode.OK);
        using JsonDocument refresh = await SendJsonAsync(
            client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        using JsonDocument active = await GetJsonAsync(client,
            "/api/review-workbench/items?category=importCleanup&state=open", HttpStatusCode.OK);
        JsonElement remaining = Assert.Single(active.RootElement.GetProperty("items").EnumerateArray());
        Assert.Contains("Unrelated import notice", remaining.GetProperty("title").GetString(), StringComparison.Ordinal);
        using JsonDocument history = await GetJsonAsync(client,
            $"/api/review-workbench/items?category=importCleanup&state={(dismissed ? "dismissed" : "resolved")}", HttpStatusCode.OK);
        JsonElement historical = Assert.Single(history.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("stableKey").GetString() == stableKey);
        Assert.Equal(dismissed ? "dismissedByUser" : "resolvedBySystem", historical.GetProperty("reason").GetString());
    }

    [Theory(DisplayName = "Historical album tag notices explain the decision after confirmation")]
    [InlineData("release_import.loose_file_album_tag_conflict", "Selected loose files have conflicting album tag hints; review the release title before confirming.", "album names")]
    [InlineData("release_import.loose_file_album_artist_conflict", "Selected loose files have conflicting album artist tag hints; review release artists before confirming.", "album artists")]
    public async Task Historical_album_tag_notices_explain_the_decision_after_confirmation(string code, string message, string field)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await host.SeedConfirmedImportNoticeAsync(code, message);
        using JsonDocument before = await GetJsonAsync(client,
            "/api/review-workbench/items?category=importCleanup", HttpStatusCode.OK);
        JsonElement notice = Assert.Single(before.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("title").GetString()!.Contains($"different {field}", StringComparison.Ordinal));
        string stableKey = notice.GetProperty("stableKey").GetString()!;
        Assert.DoesNotContain("before confirming", notice.GetProperty("title").GetString(), StringComparison.Ordinal);
        Assert.Contains("Resolve this notice if the grouping is intentional", notice.GetProperty("title").GetString(), StringComparison.Ordinal);
        using JsonDocument resolved = await SendJsonAsync(client.PatchAsJsonAsync(
            $"/api/review-workbench/items/{stableKey}/state", new { state = "resolved" }), HttpStatusCode.OK);
        using JsonDocument refresh = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        using JsonDocument after = await GetJsonAsync(client,
            "/api/review-workbench/items?category=importCleanup&state=open", HttpStatusCode.OK);
        Assert.DoesNotContain(after.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("stableKey").GetString() == stableKey);
    }
}
