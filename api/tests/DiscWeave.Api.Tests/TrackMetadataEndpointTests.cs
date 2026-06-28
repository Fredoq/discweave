using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class TrackMetadataEndpointTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Track endpoints round trip version year and original marker")]
    public async Task Track_endpoints_round_trip_version_year_and_original_marker()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title = "Age of Consent", durationSeconds = 316, versionYear = 1983, isOriginal = true });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Guid trackId = createDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/tracks/{trackId}",
            new { title = "Age of Consent (2020 Remaster)", durationSeconds = 317, versionYear = 2020, isOriginal = false });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        using HttpResponseMessage getResponse = await client.GetAsync($"/api/tracks/{trackId}");
        using JsonDocument getDocument = await ReadJsonAsync(getResponse);

        using HttpResponseMessage listResponse = await client.GetAsync("/api/tracks?search=consent&limit=10&offset=0");
        using JsonDocument listDocument = await ReadJsonAsync(listResponse);

        Assert.Equal(1983, createDocument.RootElement.GetProperty("versionYear").GetInt32());
        Assert.True(createDocument.RootElement.GetProperty("isOriginal").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(2020, updateDocument.RootElement.GetProperty("versionYear").GetInt32());
        Assert.False(updateDocument.RootElement.GetProperty("isOriginal").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        Assert.Equal(2020, getDocument.RootElement.GetProperty("versionYear").GetInt32());
        Assert.False(getDocument.RootElement.GetProperty("isOriginal").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        Assert.Equal(2020, listDocument.RootElement.GetProperty("items")[0].GetProperty("versionYear").GetInt32());
        Assert.False(listDocument.RootElement.GetProperty("items")[0].GetProperty("isOriginal").GetBoolean());
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
