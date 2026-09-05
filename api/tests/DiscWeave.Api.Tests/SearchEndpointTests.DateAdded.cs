using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class SearchEndpointTests
{
    [Theory(DisplayName = "Search sorts by date added before pagination with or without text")]
    [InlineData("")]
    [InlineData("&query=Chronology")]
    public async Task Search_sorts_by_date_added_before_pagination_with_or_without_text(string query)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid oldest = await CreateReleaseAsync(client, "Chronology Z");
        Guid middle = await CreateReleaseAsync(client, "Chronology A");
        Guid newest = await CreateReleaseAsync(client, "Chronology M");

        (string Sort, Guid[] Expected)[] cases =
        [
            ("addedNewest", [newest, middle, oldest]),
            ("addedOldest", [oldest, middle, newest])
        ];
        foreach ((string sort, Guid[] expected) in cases)
        {
            for (int offset = 0; offset < expected.Length; offset++)
            {
                using HttpResponseMessage response = await client.GetAsync($"/api/search?entityType=release&sort={sort}&limit=1&offset={offset}{query}");
                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
                using JsonDocument document = await ReadJsonAsync(response);
                Assert.Equal(3, document.RootElement.GetProperty("total").GetInt32());
                Assert.Equal(expected[offset], document.RootElement.GetProperty("items")[0].GetProperty("id").GetGuid());
            }
        }
    }

    [Fact(DisplayName = "Search rejects unknown sort orders")]
    public async Task Search_rejects_unknown_sort_orders()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using HttpResponseMessage response = await client.GetAsync("/api/search?entityType=release&sort=invalid");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
