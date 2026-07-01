using System.Net;
using System.Text.Json;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class ArtistsEndpointTests
{
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
}
