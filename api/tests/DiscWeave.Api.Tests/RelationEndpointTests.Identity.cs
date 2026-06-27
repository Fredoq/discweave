using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Artist relation endpoints reject duplicate relation identities")]
    public async Task Artist_relation_endpoints_reject_duplicate_relation_identities()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid artistId = await CreateArtistAsync(client, "Bernard Sumner");
        Guid groupId = await CreateArtistAsync(client, "New Order", "group");
        Guid otherGroupId = await CreateArtistAsync(client, "Electronic", "group");

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/artist-relations",
            new { sourceArtistId = artistId, targetArtistId = groupId, type = "memberOf", startYear = 1980 });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        Guid relationId = createDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage duplicateCreateResponse = await client.PostAsJsonAsync(
            "/api/artist-relations",
            new { sourceArtistId = artistId, targetArtistId = groupId, type = "memberOf", startYear = 1980 });
        using JsonDocument duplicateCreateDocument = await ReadJsonAsync(duplicateCreateResponse);

        using HttpResponseMessage otherCreateResponse = await client.PostAsJsonAsync(
            "/api/artist-relations",
            new { sourceArtistId = otherGroupId, targetArtistId = groupId, type = "memberOf", startYear = 1980 });
        using JsonDocument otherCreateDocument = await ReadJsonAsync(otherCreateResponse);
        Guid otherRelationId = otherCreateDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage duplicateUpdateResponse = await client.PutAsJsonAsync(
            $"/api/artist-relations/{otherRelationId}",
            new { sourceArtistId = artistId, targetArtistId = groupId, type = "memberOf", startYear = 1980 });
        using JsonDocument duplicateUpdateDocument = await ReadJsonAsync(duplicateUpdateResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicateCreateResponse.StatusCode);
        Assert.Equal("artist_relation.duplicate", duplicateCreateDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Created, otherCreateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicateUpdateResponse.StatusCode);
        Assert.Equal("artist_relation.duplicate", duplicateUpdateDocument.RootElement.GetProperty("code").GetString());
        Assert.NotEqual(relationId, otherRelationId);
    }

    [Fact(DisplayName = "Track relation endpoints reject duplicate relation identities")]
    public async Task Track_relation_endpoints_reject_duplicate_relation_identities()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid remixId = await CreateTrackAsync(client, "Blue Monday (Hardfloor Mix)");
        Guid originalId = await CreateTrackAsync(client, "Blue Monday");
        Guid alternateRemixId = await CreateTrackAsync(client, "Blue Monday (Warehouse Mix)");

        using HttpResponseMessage createResponse = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId = remixId, targetTrackId = originalId, type = "remixOf" });
        using JsonDocument createDocument = await ReadJsonAsync(createResponse);
        Guid relationId = createDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage duplicateCreateResponse = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId = remixId, targetTrackId = originalId, type = "remixOf" });
        using JsonDocument duplicateCreateDocument = await ReadJsonAsync(duplicateCreateResponse);

        using HttpResponseMessage otherCreateResponse = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId = alternateRemixId, targetTrackId = originalId, type = "remixOf" });
        using JsonDocument otherCreateDocument = await ReadJsonAsync(otherCreateResponse);
        Guid otherRelationId = otherCreateDocument.RootElement.GetProperty("id").GetGuid();

        using HttpResponseMessage duplicateUpdateResponse = await client.PutAsJsonAsync(
            $"/api/track-relations/{otherRelationId}",
            new { sourceTrackId = remixId, targetTrackId = originalId, type = "remixOf" });
        using JsonDocument duplicateUpdateDocument = await ReadJsonAsync(duplicateUpdateResponse);

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicateCreateResponse.StatusCode);
        Assert.Equal("track_relation.duplicate", duplicateCreateDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Created, otherCreateResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, duplicateUpdateResponse.StatusCode);
        Assert.Equal("track_relation.duplicate", duplicateUpdateDocument.RootElement.GetProperty("code").GetString());
        Assert.NotEqual(relationId, otherRelationId);
    }
}
