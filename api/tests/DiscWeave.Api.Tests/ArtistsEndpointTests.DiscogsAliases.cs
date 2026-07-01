using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ArtistsEndpointTests
{
    [Fact(DisplayName = "Creating a Discogs artist with real name creates aliasOf relation")]
    public async Task Creating_a_Discogs_artist_with_real_name_creates_alias_of_relation()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Flood",
                type = "person",
                discogsArtist = DiscogsAliasPayload("Flood", "Mark Ellis")
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Guid aliasArtistId = document.RootElement.GetProperty("id").GetGuid();
        Assert.Equal("person", document.RootElement.GetProperty("type").GetString());
        Assert.Equal(1, document.RootElement.GetProperty("discogsApply").GetProperty("createdAliasArtists").GetInt32());
        Assert.Equal(0, document.RootElement.GetProperty("discogsApply").GetProperty("reusedAliasArtists").GetInt32());
        Assert.Equal(1, document.RootElement.GetProperty("discogsApply").GetProperty("createdAliasRelations").GetInt32());

        using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Mark%20Ellis&limit=10&offset=0");
        using JsonDocument artistsDocument = await ReadJsonAsync(artistsResponse);
        Guid realNameArtistId = artistsDocument.RootElement.GetProperty("items")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage relationsResponse = await client.GetAsync($"/api/artist-relations?sourceArtistId={aliasArtistId}&type=aliasOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.Equal(1, relationsDocument.RootElement.GetProperty("total").GetInt32());
        JsonElement relation = relationsDocument.RootElement.GetProperty("items")[0];
        Assert.Equal(aliasArtistId, relation.GetProperty("sourceArtistId").GetGuid());
        Assert.Equal(realNameArtistId, relation.GetProperty("targetArtistId").GetGuid());
        Assert.Equal("aliasOf", relation.GetProperty("type").GetString());
    }

    [Fact(DisplayName = "Applying the same Discogs real name twice does not duplicate alias data")]
    public async Task Applying_the_same_Discogs_real_name_twice_does_not_duplicate_alias_data()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        object discogsArtist = DiscogsAliasPayload("Flood", "Mark Ellis");
        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Flood",
                type = "person",
                discogsArtist
            });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        Guid aliasArtistId = createDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/artists/{aliasArtistId}",
            new
            {
                name = "Flood",
                type = "person",
                discogsArtist
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(1, createDocument.RootElement.GetProperty("discogsApply").GetProperty("createdAliasArtists").GetInt32());
        Assert.Equal(1, createDocument.RootElement.GetProperty("discogsApply").GetProperty("createdAliasRelations").GetInt32());
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        Assert.Equal(0, updateDocument.RootElement.GetProperty("discogsApply").GetProperty("createdAliasArtists").GetInt32());
        Assert.Equal(1, updateDocument.RootElement.GetProperty("discogsApply").GetProperty("reusedAliasArtists").GetInt32());
        Assert.Equal(0, updateDocument.RootElement.GetProperty("discogsApply").GetProperty("createdAliasRelations").GetInt32());

        using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Mark%20Ellis&limit=10&offset=0");
        using JsonDocument artistsDocument = await ReadJsonAsync(artistsResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync($"/api/artist-relations?sourceArtistId={aliasArtistId}&type=aliasOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(1, artistsDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(1, relationsDocument.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Applying Discogs real name rejects conflicting aliasOf target")]
    public async Task Applying_Discogs_real_name_rejects_conflicting_alias_of_target()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage aliasResponse = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Flood",
                type = "person"
            });
        using JsonDocument aliasDocument = await ReadJsonAsync(aliasResponse);
        Guid aliasArtistId = aliasDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage existingRealNameResponse = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Existing Real Name",
                type = "person"
            });
        using JsonDocument existingRealNameDocument = await ReadJsonAsync(existingRealNameResponse);
        Guid existingRealNameId = existingRealNameDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage relationResponse = await client.PostAsJsonAsync(
            "/api/artist-relations",
            new { sourceArtistId = aliasArtistId, targetArtistId = existingRealNameId, type = "aliasOf" });

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/artists/{aliasArtistId}",
            new
            {
                name = "Flood",
                type = "person",
                discogsArtist = DiscogsAliasPayload("Flood", "Mark Ellis")
            });
        using JsonDocument updateDocument = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.Created, aliasResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Created, existingRealNameResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Created, relationResponse.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, updateResponse.StatusCode);
        Assert.Equal("artist_relation.alias_of_conflict", updateDocument.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Discogs disambiguation suffix is cleaned and matching real name does not create alias")]
    public async Task Discogs_disambiguation_suffix_is_cleaned_and_matching_real_name_does_not_create_alias()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/artists",
            new
            {
                name = "Robin Stone (2)",
                type = "person",
                discogsArtist = DiscogsAliasPayload("Robin Stone (2)", "Robin Stone")
            });
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Guid artistId = document.RootElement.GetProperty("id").GetGuid();
        Assert.Equal("Robin Stone", document.RootElement.GetProperty("name").GetString());
        Assert.Equal(JsonValueKind.Null, document.RootElement.GetProperty("discogsApply").ValueKind);

        using HttpResponseMessage artistsResponse = await client.GetAsync("/api/artists?search=Robin%20Stone&limit=10&offset=0");
        using JsonDocument artistsDocument = await ReadJsonAsync(artistsResponse);
        using HttpResponseMessage relationsResponse = await client.GetAsync($"/api/artist-relations?sourceArtistId={artistId}&type=aliasOf&limit=10&offset=0");
        using JsonDocument relationsDocument = await ReadJsonAsync(relationsResponse);

        Assert.Equal(HttpStatusCode.OK, artistsResponse.StatusCode);
        Assert.Equal(1, artistsDocument.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.OK, relationsResponse.StatusCode);
        Assert.Equal(0, relationsDocument.RootElement.GetProperty("total").GetInt32());
    }
}
