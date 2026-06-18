using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Fact(DisplayName = "Review Workbench refresh marks disappeared active items resolved by system")]
    public async Task Review_workbench_refresh_marks_disappeared_active_items_resolved_by_system()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string stableKey = await host.SeedStaleReviewIssueStateAsync();

        using JsonDocument refresh = await SendJsonAsync(
            client.PostAsync("/api/review-workbench/refresh", content: null),
            HttpStatusCode.OK);
        using JsonDocument resolvedList = await GetJsonAsync(client, "/api/review-workbench/items?state=resolved", HttpStatusCode.OK);

        Assert.Equal(1, refresh.RootElement.GetProperty("systemResolved").GetInt32());
        JsonElement item = resolvedList.RootElement.GetProperty("items").EnumerateArray()
            .Single(candidate => candidate.GetProperty("stableKey").GetString() == stableKey);
        Assert.Equal("resolvedBySystem", item.GetProperty("reason").GetString());
    }

    [Fact(DisplayName = "Review Workbench refresh preserves disappeared dismissed items")]
    public async Task Review_workbench_refresh_preserves_disappeared_dismissed_items()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string stableKey = await host.SeedStaleReviewIssueStateAsync();
        _ = await SendJsonAsync(
            client.PatchAsJsonAsync($"/api/review-workbench/items/{stableKey}/state", new { state = "dismissed" }),
            HttpStatusCode.OK);

        using JsonDocument refresh = await SendJsonAsync(
            client.PostAsync("/api/review-workbench/refresh", content: null),
            HttpStatusCode.OK);
        using JsonDocument dismissedList = await GetJsonAsync(client, "/api/review-workbench/items?state=dismissed", HttpStatusCode.OK);

        Assert.Equal(0, refresh.RootElement.GetProperty("systemResolved").GetInt32());
        JsonElement item = dismissedList.RootElement.GetProperty("items").EnumerateArray()
            .Single(candidate => candidate.GetProperty("stableKey").GetString() == stableKey);
        Assert.Equal("dismissedByUser", item.GetProperty("reason").GetString());
    }

    [Fact(DisplayName = "Review Workbench keeps dismissed and resolved generated items hidden until reopened")]
    public async Task Review_workbench_keeps_dismissed_and_resolved_generated_items_hidden_until_reopened()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateReleaseAsync(client, "Hidden Missing Release");
        _ = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", content: null), HttpStatusCode.OK);
        string stableKey = await FirstStableKeyAsync(client, "missingMetadata");
        _ = await SendJsonAsync(
            client.PatchAsJsonAsync($"/api/review-workbench/items/{stableKey}/state", new { state = "resolved" }),
            HttpStatusCode.OK);

        _ = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", content: null), HttpStatusCode.OK);
        using JsonDocument active = await GetJsonAsync(client, "/api/review-workbench/items", HttpStatusCode.OK);
        using JsonDocument resolved = await GetJsonAsync(client, "/api/review-workbench/items?state=resolved", HttpStatusCode.OK);

        Assert.DoesNotContain(active.RootElement.GetProperty("items").EnumerateArray(), item => item.GetProperty("stableKey").GetString() == stableKey);
        Assert.Contains(resolved.RootElement.GetProperty("items").EnumerateArray(), item => item.GetProperty("stableKey").GetString() == stableKey);
    }
}
