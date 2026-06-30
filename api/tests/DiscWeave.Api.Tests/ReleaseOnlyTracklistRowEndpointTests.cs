using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class ReleaseOnlyTracklistRowEndpointTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Release entry create supports release-only tracklist rows")]
    public async Task Release_entry_create_supports_release_only_tracklist_rows()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/releases",
            new
            {
                title = "DJ Mix Session",
                type = "mixtape",
                isVariousArtists = false,
                artistCredits = new object[] { new { name = "DiscWeave DJ", role = "mainArtist" } },
                labels = Array.Empty<object>(),
                notOnLabel = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                tracklist = new object[]
                {
                    new
                    {
                        trackMode = "releaseOnly",
                        title = "Intro transition",
                        position = 1,
                        durationSeconds = 47,
                        artistCredits = new object[] { new { name = "Guest MC", role = "mainArtist" } }
                    },
                    new
                    {
                        trackMode = "create",
                        title = "Catalog Theme",
                        position = 2,
                        durationSeconds = 181,
                        artistCredits = Array.Empty<object>()
                    }
                },
                ownedCopy = (object?)null
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);

        using HttpResponseMessage tracksResponse = await client.GetAsync("/api/tracks?limit=10&offset=0");
        using JsonDocument tracksDocument = await ReadJsonAsync(tracksResponse);

        using HttpResponseMessage releaseOnlySearchResponse = await client.GetAsync("/api/tracks?search=Intro%20transition&limit=10&offset=0");
        using JsonDocument releaseOnlySearchDocument = await ReadJsonAsync(releaseOnlySearchResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        JsonElement tracklist = createDocument.RootElement.GetProperty("tracklist");
        Assert.Equal(2, tracklist.GetArrayLength());
        Assert.True(tracklist[0].GetProperty("trackId").ValueKind is JsonValueKind.Null);
        Assert.True(tracklist[0].GetProperty("isReleaseOnly").GetBoolean());
        Assert.Equal("Intro transition", tracklist[0].GetProperty("title").GetString());
        Assert.Equal(47, tracklist[0].GetProperty("durationSeconds").GetInt32());
        JsonElement releaseOnlyCredits = tracklist[0].GetProperty("artistCredits");
        JsonElement releaseOnlyCredit = Assert.Single(releaseOnlyCredits.EnumerateArray());
        Assert.Equal("Guest MC", releaseOnlyCredit.GetProperty("artistName").GetString());
        Assert.Equal("mainArtist", releaseOnlyCredit.GetProperty("primaryRole").GetString());
        Assert.Equal(JsonValueKind.String, tracklist[0].GetProperty("releaseTrackId").ValueKind);
        Assert.NotEqual(Guid.Empty, tracklist[1].GetProperty("trackId").GetGuid());
        Assert.False(tracklist[1].GetProperty("isReleaseOnly").GetBoolean());
        Assert.Equal("Catalog Theme", tracklist[1].GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.OK, tracksResponse.StatusCode);
        Assert.Equal(1, tracksDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal("Catalog Theme", tracksDocument.RootElement.GetProperty("items")[0].GetProperty("title").GetString());
        Assert.Equal(HttpStatusCode.OK, releaseOnlySearchResponse.StatusCode);
        Assert.Equal(0, releaseOnlySearchDocument.RootElement.GetProperty("total").GetInt32());
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
