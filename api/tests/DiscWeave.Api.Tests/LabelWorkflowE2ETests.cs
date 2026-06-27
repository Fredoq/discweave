using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class LabelWorkflowE2ETests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Label create reuses existing label by normalized name")]
    public async Task Label_create_reuses_existing_label_by_normalized_name()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync("/api/labels", new { name = "Big Life" });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Guid labelId = createDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage reuseResponse = await client.PostAsJsonAsync("/api/labels", new { name = " big life " });
        using JsonDocument reuseDocument = await ReadJsonAsync(reuseResponse);

        using HttpResponseMessage listResponse = await client.GetAsync("/api/labels?search=Big%20Life&limit=10&offset=0");
        using JsonDocument listDocument = await ReadJsonAsync(listResponse);

        Assert.Equal(HttpStatusCode.OK, reuseResponse.StatusCode);
        Assert.Equal(labelId, reuseDocument.RootElement.GetProperty("id").GetGuid());
        Assert.Equal("Big Life", reuseDocument.RootElement.GetProperty("name").GetString());
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Equal(1, listDocument.RootElement.GetProperty("total").GetInt32());
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        string content = await response.Content.ReadAsStringAsync();
        try
        {
            return JsonDocument.Parse(content);
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException($"Response was not JSON. Status: {response.StatusCode}. Body: {content}", exception);
        }
    }
}
