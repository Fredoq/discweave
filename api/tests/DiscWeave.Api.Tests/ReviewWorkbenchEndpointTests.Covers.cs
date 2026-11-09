using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Theory(DisplayName = "Review Workbench retires multiple cover warnings without changing import records or triage history")]
    [InlineData("unpersisted", "resolved", "resolvedBySystem")]
    [InlineData("open", "resolved", "resolvedBySystem")]
    [InlineData("reopened", "resolved", "resolvedBySystem")]
    [InlineData("dismissed", "dismissed", "dismissedByUser")]
    [InlineData("resolved", "resolved", "resolvedByUser")]
    public async Task Review_workbench_retires_multiple_cover_warnings_without_changing_import_records_or_triage_history(
        string previousState, string expectedState, string expectedReason)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client, "Legacy Cover Import", 2026);
        (Guid sessionId, string stableKey) = await host.SeedLegacyCoverImportAsync(releaseId, previousState);
        using JsonDocument before = await GetJsonAsync(client, $"/api/imports/{sessionId}", HttpStatusCode.OK);
        using JsonDocument refresh = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        using JsonDocument repeatedRefresh = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", null), HttpStatusCode.OK);
        using JsonDocument active = await GetJsonAsync(client, "/api/review-workbench/items?category=importCleanup&focus=all", HttpStatusCode.OK);

        JsonElement remaining = Assert.Single(active.RootElement.GetProperty("items").EnumerateArray());
        Assert.NotEqual(stableKey, remaining.GetProperty("stableKey").GetString());
        Assert.Contains("too large", remaining.GetProperty("title").GetString(), StringComparison.Ordinal);
        Assert.Equal(1, active.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(1, active.RootElement.GetProperty("categoryCounts").GetProperty("importCleanup").GetInt32());
        using JsonDocument history = await GetJsonAsync(client,
            $"/api/review-workbench/items?category=importCleanup&state={expectedState}", HttpStatusCode.OK);
        JsonElement[] retained = [.. history.RootElement.GetProperty("items").EnumerateArray()];
        if (previousState == "unpersisted")
        {
            Assert.Empty(retained);
        }
        else
        {
            JsonElement retired = Assert.Single(retained);
            Assert.Equal(stableKey, retired.GetProperty("stableKey").GetString());
            Assert.Equal(expectedReason, retired.GetProperty("reason").GetString());
            Assert.Equal(previousState == "open" ? string.Empty : "Keep cover decision",
                await host.ReadReviewIssueNoteAsync(stableKey));
        }

        using JsonDocument after = await GetJsonAsync(client, $"/api/imports/{sessionId}", HttpStatusCode.OK);
        Assert.Equal(before.RootElement.GetRawText(), after.RootElement.GetRawText());
        JsonElement draft = Assert.Single(after.RootElement.GetProperty("drafts").EnumerateArray());
        Assert.Equal("/music/covers/album/cover.jpg", draft.GetProperty("coverPath").GetString());
        Assert.Contains(draft.GetProperty("issues").EnumerateArray(),
            issue => issue.GetProperty("code").GetString() == "import.cover_multiple_candidates");
    }
}
