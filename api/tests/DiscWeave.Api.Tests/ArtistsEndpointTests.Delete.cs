using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class ArtistsEndpointTests
{
    [Fact(DisplayName = "Deleting an artist without confirmation returns a validation error")]
    public async Task Deleting_an_artist_without_confirmation_returns_a_validation_error()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Peter Hook"));

        using HttpResponseMessage response = await client.DeleteAsync($"/api/artists/{artistId}");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("delete.confirmation_required", document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Deleting an artist with mismatched confirmation returns a validation error")]
    public async Task Deleting_an_artist_with_mismatched_confirmation_returns_a_validation_error()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Peter Hook"));
        using HttpRequestMessage request = new(HttpMethod.Delete, $"/api/artists/{artistId}");
        request.Headers.Add("X-DiscWeave-Confirm-Delete", $"artist:{Guid.CreateVersion7()}");

        using HttpResponseMessage response = await client.SendAsync(request);
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("delete.confirmation_required", document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Deleting an artist with matching confirmation removes the artist")]
    public async Task Deleting_an_artist_with_matching_confirmation_removes_the_artist()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId artistId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Stephen Morris"));
        using HttpRequestMessage request = new(HttpMethod.Delete, $"/api/artists/{artistId}");
        request.Headers.Add("X-DiscWeave-Confirm-Delete", $"artist:{artistId}");

        using HttpResponseMessage response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await host.FindArtistAsync(artistId));
    }

    [Fact(DisplayName = "Deleting an artist removes dependent credits and relations")]
    public async Task Deleting_an_artist_removes_dependent_credits_and_relations()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Artist artist = Person.Create(host.DefaultCollectionId, ArtistId.New(), "Arthur Baker");
        ArtistId artistId = await host.SeedArtistAsync(artist);
        Artist otherArtist = Person.Create(host.DefaultCollectionId, ArtistId.New(), "New Order");
        ArtistId otherArtistId = await host.SeedArtistAsync(otherArtist);
        await host.SeedReleaseCreditAsync(artist);
        using HttpResponseMessage relationResponse = await client.PostAsJsonAsync(
            "/api/artist-relations",
            new { sourceArtistId = artistId.Value, targetArtistId = otherArtistId.Value, type = "collaboration" });
        using JsonDocument relationDocument = await ReadJsonAsync(relationResponse);
        Assert.Equal(HttpStatusCode.Created, relationResponse.StatusCode);
        using HttpRequestMessage request = new(HttpMethod.Delete, $"/api/artists/{artistId}");
        request.Headers.Add("X-DiscWeave-Confirm-Delete", $"artist:{artistId}");

        using HttpResponseMessage response = await client.SendAsync(request);
        using HttpResponseMessage creditsResponse = await client.GetAsync($"/api/credits?contributorArtistId={artistId.Value}&limit=10&offset=0");
        using JsonDocument creditsDocument = await ReadJsonAsync(creditsResponse);
        using HttpResponseMessage relationGetResponse = await client.GetAsync($"/api/artist-relations/{relationDocument.RootElement.GetProperty("id").GetGuid()}");
        using JsonDocument relationGetDocument = await ReadJsonAsync(relationGetResponse);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Null(await host.FindArtistAsync(artistId));
        Assert.Equal(HttpStatusCode.OK, creditsResponse.StatusCode);
        Assert.Equal(0, creditsDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, relationGetResponse.StatusCode);
        Assert.Equal("artist_relation.not_found", relationGetDocument.RootElement.GetProperty("code").GetString());
    }
}
