using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class SearchEndpointTests
{
    [Fact(DisplayName = "Search Discogs linked artists includes identity hint")]
    public async Task Search_Discogs_linked_artists_includes_identity_hint()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        var appliedAt = new DateTimeOffset(2026, 7, 1, 12, 0, 0, TimeSpan.Zero);
        Guid discogsArtistId = await CreateArtistAsync(
            client,
            "Discogs Search Artist",
            [
                new ExternalSourceRequest(
                    "discogs",
                    "artist",
                    "222",
                    "https://www.discogs.com/artist/222",
                    appliedAt)
            ]);
        Guid nonDiscogsArtistId = await CreateArtistAsync(
            client,
            "MusicBrainz Search Artist",
            [
                new ExternalSourceRequest(
                    "musicbrainz",
                    "artist",
                    "333",
                    "https://musicbrainz.org/artist/333",
                    appliedAt)
            ]);
        Guid labelId = await CreateLabelAsync(client, "Hintless Search Label");

        JsonElement discogsArtist = await GetSingleSearchResultAsync(client, "Discogs Search Artist", "artist", discogsArtistId, "artist");
        JsonElement nonDiscogsArtist = await GetSingleSearchResultAsync(client, "MusicBrainz Search Artist", "artist", nonDiscogsArtistId, "artist");
        JsonElement label = await GetSingleSearchResultAsync(client, "Hintless Search Label", "label", labelId, "label");

        Assert.Equal("Discogs #222", discogsArtist.GetProperty("identityHint").GetString());
        Assert.Equal(JsonValueKind.Null, nonDiscogsArtist.GetProperty("identityHint").ValueKind);
        Assert.Equal(JsonValueKind.Null, label.GetProperty("identityHint").ValueKind);
    }

    [Fact(DisplayName = "Search paginates before returning artist identity hints")]
    public async Task Search_paginates_before_returning_artist_identity_hints()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        var appliedAt = new DateTimeOffset(2026, 7, 1, 12, 0, 0, TimeSpan.Zero);
        Guid alphaArtistId = await CreateArtistAsync(
            client,
            "Paged Search Artist Alpha",
            [
                new ExternalSourceRequest(
                    "discogs",
                    "artist",
                    "101",
                    "https://www.discogs.com/artist/101",
                    appliedAt)
            ]);
        Guid betaArtistId = await CreateArtistAsync(
            client,
            "Paged Search Artist Beta",
            [
                new ExternalSourceRequest(
                    "discogs",
                    "artist",
                    "202",
                    "https://www.discogs.com/artist/202",
                    appliedAt)
            ]);
        Guid gammaArtistId = await CreateArtistAsync(client, "Paged Search Artist Gamma");
        var expectedHints = new Dictionary<Guid, string?>
        {
            [alphaArtistId] = "Discogs #101",
            [betaArtistId] = "Discogs #202",
            [gammaArtistId] = null,
        };

        using HttpResponseMessage firstPageResponse = await client.GetAsync("/api/search?query=Paged%20Search%20Artist&entityType=artist&limit=1&offset=0");
        using JsonDocument firstPageDocument = await ReadJsonAsync(firstPageResponse);
        using HttpResponseMessage secondPageResponse = await client.GetAsync("/api/search?query=Paged%20Search%20Artist&entityType=artist&limit=1&offset=1");
        using JsonDocument secondPageDocument = await ReadJsonAsync(secondPageResponse);
        Assert.Equal(HttpStatusCode.OK, firstPageResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondPageResponse.StatusCode);
        JsonElement firstPageItem = Assert.Single(firstPageDocument.RootElement.GetProperty("items").EnumerateArray());
        JsonElement secondPageRoot = secondPageDocument.RootElement;
        JsonElement secondPageItem = Assert.Single(secondPageRoot.GetProperty("items").EnumerateArray());
        Guid secondPageArtistId = secondPageItem.GetProperty("id").GetGuid();

        Assert.Equal(3, secondPageRoot.GetProperty("total").GetInt32());
        Assert.Equal(1, secondPageRoot.GetProperty("limit").GetInt32());
        Assert.Equal(1, secondPageRoot.GetProperty("offset").GetInt32());
        Assert.NotEqual(firstPageItem.GetProperty("id").GetGuid(), secondPageArtistId);
        Assert.StartsWith("Paged Search Artist ", secondPageItem.GetProperty("title").GetString());
        Assert.True(expectedHints.ContainsKey(secondPageArtistId));
        Assert.Equal(expectedHints[secondPageArtistId], secondPageItem.GetProperty("identityHint").GetString());
    }
}
