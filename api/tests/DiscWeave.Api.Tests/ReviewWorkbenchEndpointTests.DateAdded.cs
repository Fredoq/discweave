using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests
{
    [Fact(DisplayName = "Review Workbench sorts by first detection before pagination")]
    public async Task Review_workbench_sorts_by_first_detection_before_pagination()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateReleaseAsync(client, "Z older issue");
        using JsonDocument firstRefresh = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", content: null), HttpStatusCode.OK);
        _ = await CreateReleaseAsync(client, "A newer issue");
        using JsonDocument secondRefresh = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", content: null), HttpStatusCode.OK);

        foreach ((string sort, string title) in new[] { ("addedOldest", "Z older issue"), ("addedNewest", "A newer issue") })
        {
            using JsonDocument list = await GetJsonAsync(client, $"/api/review-workbench/items?category=missingMetadata&sort={sort}&limit=1", HttpStatusCode.OK);
            Assert.Contains(title, list.RootElement.GetProperty("items")[0].GetProperty("title").GetString(), StringComparison.Ordinal);
        }
        using HttpResponseMessage invalid = await client.GetAsync("/api/review-workbench/items?sort=invalid");
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }
}
