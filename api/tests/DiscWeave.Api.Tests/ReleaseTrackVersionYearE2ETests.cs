using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class ReleaseTrackVersionYearE2ETests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Release entry tracklist defaults track version year to release year and allows override")]
    public async Task Release_entry_tracklist_defaults_track_version_year_to_release_year_and_allows_override()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/releases",
            new
            {
                title = "Version Year Release",
                type = "album",
                isVariousArtists = false,
                artistCredits = new object[] { new { name = "Version Year Artist", role = "mainArtist" } },
                labels = Array.Empty<object>(),
                notOnLabel = true,
                year = 1995,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                tracklist = new object[]
                {
                    new
                    {
                        title = "Version Year Default",
                        position = 1,
                        durationSeconds = 241,
                        artistCredits = Array.Empty<object>()
                    },
                    new
                    {
                        title = "Version Year Override",
                        position = 2,
                        durationSeconds = 252,
                        versionYear = 1993,
                        artistCredits = Array.Empty<object>()
                    }
                },
                ownedCopy = (object?)null
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(2, createDocument.RootElement.GetProperty("tracklist").GetArrayLength());

        using HttpResponseMessage tracksResponse = await client.GetAsync("/api/tracks?search=Version%20Year&limit=10&offset=0");
        using JsonDocument tracksDocument = await ReadJsonAsync(tracksResponse);

        Assert.Equal(HttpStatusCode.OK, tracksResponse.StatusCode);
        Assert.Equal(2, tracksDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(1995, FindTrack(tracksDocument, "Version Year Default").GetProperty("versionYear").GetInt32());
        Assert.Equal(1993, FindTrack(tracksDocument, "Version Year Override").GetProperty("versionYear").GetInt32());
    }

    private static JsonElement FindTrack(JsonDocument document, string title)
    {
        return document.RootElement.GetProperty("items").EnumerateArray().Single(track => track.GetProperty("title").GetString() == title);
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
