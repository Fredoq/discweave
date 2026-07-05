using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class ReleaseEntryCollectionItemsE2ETests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    private static readonly string[] ElectronicGenres = ["IDM", "Electronic"];

    [Fact(DisplayName = "Release entry create persists multiple collection items including wanted digital")]
    public async Task Release_entry_create_persists_multiple_collection_items_including_wanted_digital()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Collection Target Artist");

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/releases",
            new
            {
                title = "Wanted Digital Target",
                type = "maxiSingle",
                isVariousArtists = false,
                artistCredits = new object[] { new { artistId, role = "mainArtist" } },
                labels = Array.Empty<object>(),
                notOnLabel = true,
                year = 1996,
                genres = ElectronicGenres,
                tags = Array.Empty<string>(),
                tracklist = new object[]
                {
                    new
                    {
                        title = "Wanted Mix",
                        position = 1,
                        durationSeconds = 357,
                        artistCredits = Array.Empty<object>()
                    }
                },
                ownedCopies = new object[]
                {
                    new
                    {
                        status = "wanted",
                        medium = new { type = "digital" },
                        condition = (string?)null,
                        storageLocation = (string?)null,
                        note = "Find lossless digital version"
                    },
                    new
                    {
                        status = "owned",
                        medium = new { type = "vinyl", description = "12-inch vinyl" },
                        condition = "veryGood",
                        storageLocation = "Shelf A3",
                        note = "Shelf copy"
                    }
                }
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Guid releaseId = createDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement[] items = await LoadReleaseOwnedItemsAsync(client, releaseId);

        Assert.Equal(2, items.Length);
        JsonElement wantedDigital = Assert.Single(items, item => item.GetProperty("status").GetString() == "wanted");
        Assert.Equal("digital", wantedDigital.GetProperty("medium").GetProperty("type").GetString());
        Assert.Equal("Find lossless digital version", wantedDigital.GetProperty("note").GetString());
        Assert.Equal(JsonValueKind.Object, wantedDigital.GetProperty("details").GetProperty("digital").ValueKind);
        Assert.Equal(JsonValueKind.Null, wantedDigital.GetProperty("details").GetProperty("vinyl").ValueKind);
        JsonElement ownedVinyl = Assert.Single(items, item => item.GetProperty("status").GetString() == "owned");
        Assert.Equal("vinyl", ownedVinyl.GetProperty("medium").GetProperty("type").GetString());
        Assert.Equal("Shelf A3", ownedVinyl.GetProperty("details").GetProperty("vinyl").GetProperty("storageLocation").GetString());
        Assert.Equal("Shelf copy", ownedVinyl.GetProperty("note").GetString());
    }

    [Fact(DisplayName = "Release entry update does not delete omitted collection items")]
    public async Task Release_entry_update_does_not_delete_omitted_collection_items()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Collection Update Artist");

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/releases",
            new
            {
                title = "Collection Update Target",
                type = "maxiSingle",
                isVariousArtists = false,
                artistCredits = new object[] { new { artistId, role = "mainArtist" } },
                labels = Array.Empty<object>(),
                notOnLabel = true,
                year = 1996,
                genres = ElectronicGenres,
                tags = Array.Empty<string>(),
                tracklist = new object[]
                {
                    new
                    {
                        title = "Update Mix",
                        position = 1,
                        durationSeconds = 357,
                        artistCredits = Array.Empty<object>()
                    }
                },
                ownedCopies = new object[]
                {
                    new
                    {
                        status = "wanted",
                        medium = new { type = "digital" },
                        condition = (string?)null,
                        storageLocation = (string?)null,
                        note = "Initial digital target"
                    },
                    new
                    {
                        status = "owned",
                        medium = new { type = "vinyl", description = "12-inch vinyl" },
                        condition = "veryGood",
                        storageLocation = "Shelf A3",
                        note = "Keep this copy"
                    }
                }
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Guid releaseId = createDocument.RootElement.GetProperty("id").GetGuid();
        JsonElement[] initialItems = await LoadReleaseOwnedItemsAsync(client, releaseId);
        Guid digitalItemId = Assert.Single(initialItems, item => item.GetProperty("status").GetString() == "wanted").GetProperty("id").GetGuid();
        Guid vinylItemId = Assert.Single(initialItems, item => item.GetProperty("status").GetString() == "owned").GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/releases/{releaseId}",
            new
            {
                title = "Collection Update Target",
                type = "maxiSingle",
                isVariousArtists = false,
                artistCredits = new object[] { new { artistId, role = "mainArtist" } },
                labels = Array.Empty<object>(),
                notOnLabel = true,
                year = 1996,
                genres = ElectronicGenres,
                tags = Array.Empty<string>(),
                ownedCopies = new object[]
                {
                    new
                    {
                        id = digitalItemId,
                        status = "owned",
                        medium = new { type = "digital" },
                        condition = (string?)null,
                        storageLocation = (string?)null,
                        note = "Downloaded lossless version"
                    },
                    new
                    {
                        status = "wanted",
                        medium = new { type = "cd", discCount = 1 },
                        condition = (string?)null,
                        storageLocation = (string?)null,
                        note = "Find CD backup"
                    }
                }
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal("Collection Update Target", updateDocument.RootElement.GetProperty("title").GetString());
        JsonElement[] items = await LoadReleaseOwnedItemsAsync(client, releaseId);

        Assert.Equal(3, items.Length);
        JsonElement updatedDigital = Assert.Single(items, item => item.GetProperty("id").GetGuid() == digitalItemId);
        Assert.Equal("owned", updatedDigital.GetProperty("status").GetString());
        Assert.Equal("digital", updatedDigital.GetProperty("medium").GetProperty("type").GetString());
        Assert.Equal("Downloaded lossless version", updatedDigital.GetProperty("note").GetString());
        JsonElement retainedVinyl = Assert.Single(items, item => item.GetProperty("id").GetGuid() == vinylItemId);
        Assert.Equal("owned", retainedVinyl.GetProperty("status").GetString());
        Assert.Equal("vinyl", retainedVinyl.GetProperty("medium").GetProperty("type").GetString());
        Assert.Equal("Keep this copy", retainedVinyl.GetProperty("note").GetString());
        JsonElement wantedCd = Assert.Single(items, item => item.GetProperty("medium").GetProperty("type").GetString() == "cd");
        Assert.Equal("wanted", wantedCd.GetProperty("status").GetString());
        Assert.Equal("Find CD backup", wantedCd.GetProperty("note").GetString());
    }

    private static async Task<JsonElement[]> LoadReleaseOwnedItemsAsync(HttpClient client, Guid releaseId)
    {
        using HttpResponseMessage response = await client.GetAsync("/api/owned-items?limit=10&offset=0");
        using JsonDocument document = await ReadJsonAsync(response);

        return
        [
            .. document.RootElement.GetProperty("items").EnumerateArray()
                .Where(item => item.GetProperty("releaseId").GetGuid() == releaseId)
                .Select(item => item.Clone())
        ];
    }

    private static async Task<Guid> CreateArtistAsync(HttpClient client, string name)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/artists", new { type = "person", name });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
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
