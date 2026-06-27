using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class ReleaseEntryLabelNormalizationE2ETests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Release entry create reuses labels by normalized name within the same request")]
    public async Task Release_entry_create_reuses_labels_by_normalized_name_within_the_same_request()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/releases",
            new
            {
                title = "Normalized Shared Label Draft",
                type = "album",
                isVariousArtists = false,
                artistCredits = new object[] { new { name = "Shared Label Artist", role = "mainArtist" } },
                labels = new object[]
                {
                    new { name = " Shared Label ", catalogNumber = "SL-1", hasNoCatalogNumber = false },
                    new { name = "shared label", catalogNumber = "SL-2", hasNoCatalogNumber = false }
                },
                notOnLabel = false,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                tracklist = Array.Empty<object>(),
                ownedCopy = (object?)null
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(2, createDocument.RootElement.GetProperty("labels").GetArrayLength());
        Guid firstLabelId = createDocument.RootElement.GetProperty("labels")[0].GetProperty("labelId").GetGuid();
        Guid secondLabelId = createDocument.RootElement.GetProperty("labels")[1].GetProperty("labelId").GetGuid();
        Assert.Equal(firstLabelId, secondLabelId);

        using HttpResponseMessage labelsResponse = await client.GetAsync("/api/labels?search=Shared%20Label&limit=10&offset=0");
        using JsonDocument labelsDocument = await ReadJsonAsync(labelsResponse);

        Assert.Equal(HttpStatusCode.OK, labelsResponse.StatusCode);
        Assert.Equal(1, labelsDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal("Shared Label", labelsDocument.RootElement.GetProperty("items")[0].GetProperty("name").GetString());
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
