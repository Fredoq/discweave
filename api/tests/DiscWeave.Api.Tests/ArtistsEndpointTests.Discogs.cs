using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class ArtistsEndpointTests
{
    [Fact(DisplayName = "Creating a Discogs group creates member artists and memberOf relations")]
    public async Task Creating_a_Discogs_group_creates_member_artists_and_member_relations()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        ArtistId existingMemberId = await host.SeedArtistAsync(Person.Create(host.DefaultCollectionId, ArtistId.New(), "Martin L. Gore"));

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Depeche Mode",
                type = "person",
                discogsArtist = DiscogsGroupPayload("Depeche Mode", ["Dave Gahan", "Martin L. Gore", "Dave Gahan"])
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Guid groupId = document.RootElement.GetProperty("id").GetGuid();
        Assert.Equal("group", document.RootElement.GetProperty("type").GetString());
        Assert.Equal(1, document.RootElement.GetProperty("discogsApply").GetProperty("createdMemberArtists").GetInt32());
        Assert.Equal(1, document.RootElement.GetProperty("discogsApply").GetProperty("reusedMemberArtists").GetInt32());
        Assert.Equal(2, document.RootElement.GetProperty("discogsApply").GetProperty("createdMemberRelations").GetInt32());

        using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Dave%20Gahan&limit=10&offset=0");
        using JsonDocument artistsDocument = await ReadJsonAsync(artistsResponse);
        Guid createdMemberId = artistsDocument.RootElement.GetProperty("items")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage relationsResponse = await client.GetAsync($"/api/artist-relations?targetArtistId={groupId}&type=memberOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.Equal(2, relationsDocument.RootElement.GetProperty("total").GetInt32());
        Guid[] relationSourceIds =
        [
            .. relationsDocument.RootElement.GetProperty("items").EnumerateArray()
            .Select(item => item.GetProperty("sourceArtistId").GetGuid())
        ];
        Assert.Contains(existingMemberId.Value, relationSourceIds);
        Assert.Contains(createdMemberId, relationSourceIds);
    }

    [Fact(DisplayName = "Applying the same Discogs group twice does not duplicate members or relations")]
    public async Task Applying_the_same_Discogs_group_twice_does_not_duplicate_members_or_relations()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        object discogsArtist = DiscogsGroupPayload("Depeche Mode", ["Dave Gahan", "Martin L. Gore"]);
        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Depeche Mode",
                type = "person",
                discogsArtist
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        Guid groupId = createDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/artists/{groupId}",
            new
            {
                name = "Depeche Mode",
                type = "person",
                discogsArtist
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(2, createDocument.RootElement.GetProperty("discogsApply").GetProperty("createdMemberArtists").GetInt32());
        Assert.Equal(2, createDocument.RootElement.GetProperty("discogsApply").GetProperty("createdMemberRelations").GetInt32());
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal("group", updateDocument.RootElement.GetProperty("type").GetString());
        Assert.Equal(0, updateDocument.RootElement.GetProperty("discogsApply").GetProperty("createdMemberArtists").GetInt32());
        Assert.Equal(2, updateDocument.RootElement.GetProperty("discogsApply").GetProperty("reusedMemberArtists").GetInt32());
        Assert.Equal(0, updateDocument.RootElement.GetProperty("discogsApply").GetProperty("createdMemberRelations").GetInt32());

        using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Dave%20Gahan&limit=10&offset=0");
        using JsonDocument artistsDocument = await ReadJsonAsync(artistsResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync($"/api/artist-relations?targetArtistId={groupId}&type=memberOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, artistsResponse.StatusCode);
        Assert.Equal(1, artistsDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.Equal(2, relationsDocument.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Updating an artist with Discogs data preserves unrelated external sources")]
    public async Task Updating_an_artist_with_Discogs_data_preserves_unrelated_external_sources()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Artist artist = Person.Create(host.DefaultCollectionId, ArtistId.New(), "Depeche Mode");
        artist.ReplaceExternalSources(
        [
            ExternalSource("musicbrainz", "artist", "8538e728-ca0b-4321-b7e5-cff6565dd4c0"),
            ExternalSource("discogs", "artist", "1111")
        ]);
        ArtistId artistId = await host.SeedArtistAsync(artist);

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/artists/{artistId}",
            new
            {
                name = "Depeche Mode",
                type = "person",
                externalSources = new[]
                {
                    Source("musicbrainz", "artist", "8538e728-ca0b-4321-b7e5-cff6565dd4c0")
                },
                discogsArtist = DiscogsGroupPayload("Depeche Mode", ["Dave Gahan"])
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement[] sources = [.. document.RootElement.GetProperty("externalSources").EnumerateArray()];
        Assert.Equal(2, sources.Length);
        Assert.Contains(sources, source => source.GetProperty("providerName").GetString() == "musicbrainz");
        JsonElement discogsSource = Assert.Single(
            sources,
            source => source.GetProperty("providerName").GetString() == "discogs");
        Assert.Equal("2725", discogsSource.GetProperty("externalId").GetString());
    }

    [Fact(DisplayName = "Creating an artist with invalid Discogs artist payload returns a validation error")]
    public async Task Creating_an_artist_with_invalid_Discogs_artist_payload_returns_a_validation_error()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Invalid Discogs Artist",
                type = "person",
                discogsArtist = new
                {
                    source = (object?)null,
                    name = "Invalid Discogs Artist",
                    aliases = Array.Empty<string>(),
                    members = Array.Empty<string>(),
                    nameVariations = Array.Empty<string>()
                }
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("artist.discogs_artist_invalid", document.RootElement.GetProperty("code").GetString());
        Assert.Equal("Discogs artist payload is invalid", document.RootElement.GetProperty("message").GetString());
    }

    private static object DiscogsGroupPayload(string name, string[] members)
    {
        return new
        {
            source = new
            {
                providerName = "discogs",
                resourceType = "artist",
                externalId = "2725",
                sourceUrl = "https://www.discogs.com/artist/2725"
            },
            name,
            profile = "English electronic music band.",
            aliases = Array.Empty<string>(),
            members,
            nameVariations = Array.Empty<string>()
        };
    }

    private static object DiscogsAliasPayload(string name, string realName)
    {
        return new
        {
            source = new
            {
                providerName = "discogs",
                resourceType = "artist",
                externalId = "23282",
                sourceUrl = "https://www.discogs.com/artist/23282"
            },
            name,
            realName,
            profile = "Post-punk record producer and DJ.",
            aliases = Array.Empty<string>(),
            members = Array.Empty<string>(),
            nameVariations = Array.Empty<string>()
        };
    }

    private static object Source(string providerName, string resourceType, string externalId)
    {
        return new
        {
            providerName,
            resourceType,
            externalId,
            sourceUrl = $"https://example.test/{providerName}/{resourceType}/{externalId}",
            appliedAt = new DateTimeOffset(2026, 5, 31, 12, 0, 0, TimeSpan.Zero)
        };
    }

    private static ExternalSourceReference ExternalSource(string providerName, string resourceType, string externalId)
    {
        return ExternalSourceReference.Create(
            providerName,
            resourceType,
            externalId,
            $"https://example.test/{providerName}/{resourceType}/{externalId}",
            new DateTimeOffset(2026, 5, 31, 12, 0, 0, TimeSpan.Zero));
    }
}
