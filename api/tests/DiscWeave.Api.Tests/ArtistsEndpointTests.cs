using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class ArtistsEndpointTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ArtistsEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Creating a person returns the created artist")]
    public async Task Creating_a_person_returns_the_created_artist()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new CreateArtistRequest("person", "  Bernard Sumner  "));

        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Guid artistId = document.RootElement.GetProperty("id").GetGuid();
        Assert.NotEqual(Guid.Empty, artistId);
        Assert.Equal($"/api/artists/{artistId}", response.Headers.Location?.OriginalString);
        Assert.Equal("person", document.RootElement.GetProperty("type").GetString());
        Assert.Equal("Bernard Sumner", document.RootElement.GetProperty("name").GetString());
    }

    [Fact(DisplayName = "Creating a group returns the created artist")]
    public async Task Creating_a_group_returns_the_created_artist()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new CreateArtistRequest("group", "New Order"));

        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("group", document.RootElement.GetProperty("type").GetString());
        Assert.Equal("New Order", document.RootElement.GetProperty("name").GetString());
    }

    [Fact(DisplayName = "Creating an artist with a blank name returns a validation error")]
    public async Task Creating_an_artist_with_a_blank_name_returns_a_validation_error()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new CreateArtistRequest("person", " "));

        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("artist.name_required", document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Creating an artist with an invalid type returns a validation error")]
    public async Task Creating_an_artist_with_an_invalid_type_returns_a_validation_error()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new CreateArtistRequest("alias", "Electronic"));

        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("artist.type_invalid", document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Getting an existing artist returns the artist")]
    public async Task Getting_an_existing_artist_returns_the_artist()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Gillian Gilbert"));

        using HttpResponseMessage response = await client.GetAsync($"/api/artists/{artistId}");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(artistId.Value, document.RootElement.GetProperty("id").GetGuid());
        Assert.Equal("person", document.RootElement.GetProperty("type").GetString());
        Assert.Equal("Gillian Gilbert", document.RootElement.GetProperty("name").GetString());
    }

    [Fact(DisplayName = "Getting a missing artist returns not found")]
    public async Task Getting_a_missing_artist_returns_not_found()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync($"/api/artists/{Guid.CreateVersion7()}");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("artist.not_found", document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Listing artists returns deterministic filtered pages")]
    public async Task Listing_artists_returns_deterministic_filtered_pages()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await host.SeedArtistAsync(Group.Create(host.DefaultCollectionId, ArtistId.New(), "New Order"));
        _ = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Bernard Sumner"));
        _ = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Gillian Gilbert"));

        using HttpResponseMessage response = await client.GetAsync("/api/artists?search=gi&type=person&limit=1&offset=0");
        using JsonDocument document = await ReadJsonAsync(response);

        JsonElement root = document.RootElement;
        JsonElement firstItem = root.GetProperty("items")[0];
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, root.GetProperty("limit").GetInt32());
        Assert.Equal(0, root.GetProperty("offset").GetInt32());
        Assert.Equal(1, root.GetProperty("total").GetInt32());
        Assert.Equal("Gillian Gilbert", firstItem.GetProperty("name").GetString());
        Assert.Equal("person", firstItem.GetProperty("type").GetString());
    }

    [Fact(DisplayName = "Listing Discogs linked artists includes identity hint")]
    public async Task Listing_Discogs_linked_artists_includes_identity_hint()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Artist artist = Person.Create(host.DefaultCollectionId, ArtistId.New(), "Robin Stone");
        artist.ReplaceExternalSources(
        [
            ExternalSourceReference.Create(
                "discogs",
                "artist",
                "111",
                "https://www.discogs.com/artist/111",
                new DateTimeOffset(2026, 7, 1, 12, 0, 0, TimeSpan.Zero))
        ]);
        _ = await host.SeedArtistAsync(artist);

        using HttpResponseMessage response = await client.GetAsync("/api/artists?search=Robin%20Stone&limit=10&offset=0");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement item = document.RootElement.GetProperty("items")[0];
        Assert.Equal("Robin Stone", item.GetProperty("name").GetString());
        Assert.Equal("Discogs #111", item.GetProperty("identityHint").GetString());
    }

    [Fact(DisplayName = "Listing artists with invalid pagination returns a validation error")]
    public async Task Listing_artists_with_invalid_pagination_returns_a_validation_error()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync("/api/artists?limit=0&offset=-1");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("pagination.invalid", document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Listing artists with an invalid type returns a validation error")]
    public async Task Listing_artists_with_an_invalid_type_returns_a_validation_error()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync("/api/artists?type=alias");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("artist.type_invalid", document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Updating an artist renames the artist without changing identity or type")]
    public async Task Updating_an_artist_renames_the_artist_without_changing_identity_or_type()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId artistId = await host.SeedArtistAsync(Group.Create(host.DefaultCollectionId, ArtistId.New(), "Joy Division"));

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/artists/{artistId}",
            new UpdateArtistRequest("  Warsaw  "));
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(artistId.Value, document.RootElement.GetProperty("id").GetGuid());
        Assert.Equal("group", document.RootElement.GetProperty("type").GetString());
        Assert.Equal("Warsaw", document.RootElement.GetProperty("name").GetString());
    }

    [Fact(DisplayName = "Updating an artist can change artist type")]
    public async Task Updating_an_artist_can_change_artist_type()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Depeche Mode"));

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/artists/{artistId}",
            new
            {
                name = "Depeche Mode",
                type = "group"
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(artistId.Value, document.RootElement.GetProperty("id").GetGuid());
        Assert.Equal("group", document.RootElement.GetProperty("type").GetString());
        Assert.Equal("Depeche Mode", document.RootElement.GetProperty("name").GetString());

        using HttpResponseMessage getResponse = await client.GetAsync($"/api/artists/{artistId}");
        using JsonDocument getDocument = await ReadJsonAsync(getResponse);
        using HttpResponseMessage listResponse = await client.GetAsync("/api/artists?type=group&limit=10&offset=0");
        using JsonDocument listDocument = await ReadJsonAsync(listResponse);

        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);
        Assert.Equal("group", getDocument.RootElement.GetProperty("type").GetString());
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        JsonElement matchingArtist = Assert.Single(listDocument.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal(artistId.Value, matchingArtist.GetProperty("id").GetGuid());
        Assert.Equal("group", matchingArtist.GetProperty("type").GetString());
    }

    [Fact(DisplayName = "Updating an artist type refreshes the search subtitle")]
    public async Task Updating_an_artist_type_refreshes_the_search_subtitle()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Search Type Artist"));

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/artists/{artistId}",
            new
            {
                name = "Search Type Artist",
                type = "group"
            });
        using JsonDocument updateDocument = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("group", updateDocument.RootElement.GetProperty("type").GetString());

        using HttpResponseMessage searchResponse = await client.GetAsync("/api/search?query=Search%20Type%20Artist&limit=20&offset=0");
        using JsonDocument searchDocument = await ReadJsonAsync(searchResponse);

        Assert.Equal(HttpStatusCode.OK, searchResponse.StatusCode);
        JsonElement item = Assert.Single(
            searchDocument.RootElement.GetProperty("items").EnumerateArray(),
            result => result.GetProperty("type").GetString() == "artist" && result.GetProperty("id").GetGuid() == artistId.Value);
        Assert.Equal("group", item.GetProperty("subtitle").GetString());
    }

    [Fact(DisplayName = "Updating an artist with invalid type returns a validation error")]
    public async Task Updating_an_artist_with_invalid_type_returns_a_validation_error()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Archive Artist"));

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/artists/{artistId}",
            new
            {
                name = "Archive Artist",
                type = "alias"
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("artist.type_invalid", document.RootElement.GetProperty("code").GetString());
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
            throw new InvalidOperationException(content, exception);
        }
    }

}
