using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DiscWeave.Api.Tests;

public sealed partial class ExportRestoreEndpointTests
{
    [Fact(DisplayName = "JSON restore converts ten-point ratings from older snapshots")]
    public async Task Json_restore_converts_ten_point_ratings_from_older_snapshots()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient adminClient = await host.CreateAuthenticatedClientAsync();
        Guid labelId = await CreateLabelAsync(adminClient, "Factory Records");
        Guid artistId = await CreateArtistAsync(adminClient, "New Order");
        (_, Guid trackId) = await CreateReleaseWithTrackIdsAsync(adminClient, labelId, artistId);
        _ = await CreateRatingAsync(adminClient, trackId, await FindOverallCriterionIdAsync(adminClient));
        JsonObject document = JsonNode.Parse(await ExportJsonAsync(adminClient))!.AsObject();
        document["formatVersion"] = 2;
        JsonObject legacyRating = document["ratings"]!.AsArray()[0]!.AsObject();
        legacyRating["value"] = 10;
        _ = legacyRating.Remove("standout");
        HttpClient userClient = await CreateUserClientAsync(host, adminClient);

        using HttpResponseMessage restoreResponse = await PostRestoreAsync(userClient, document.ToJsonString());
        string restoreJson = await restoreResponse.Content.ReadAsStringAsync();
        using var restored = JsonDocument.Parse(await ExportJsonAsync(userClient));
        JsonElement rating = restored.RootElement.GetProperty("ratings")[0];

        Assert.True(restoreResponse.StatusCode == HttpStatusCode.OK, restoreJson);
        Assert.Equal(5, rating.GetProperty("value").GetInt32());
        Assert.True(rating.GetProperty("standout").GetBoolean());
    }

    [Fact(DisplayName = "Standout is accepted only on the maximum rating")]
    public async Task Standout_is_accepted_only_on_the_maximum_rating()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid trackId = await CreateTrackAsync(client, "Blue Monday");
        Guid criterionId = await FindOverallCriterionIdAsync(client);

        using HttpResponseMessage rejected = await client.PutAsJsonAsync(
            $"/api/ratings/track/{trackId}/{criterionId}",
            new { value = 4, standout = true });
        using JsonDocument rejectedDocument = await ReadJsonAsync(rejected);
        using HttpResponseMessage accepted = await client.PutAsJsonAsync(
            $"/api/ratings/track/{trackId}/{criterionId}",
            new { value = 5, standout = true });
        using JsonDocument acceptedDocument = await ReadJsonAsync(accepted);

        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.Equal("rating.standout_requires_maximum", rejectedDocument.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.OK, accepted.StatusCode);
        Assert.True(acceptedDocument.RootElement.GetProperty("standout").GetBoolean());
    }

    [Fact(DisplayName = "Rating averages cover the release, its label, the credited alias, and the artist behind it")]
    public async Task Rating_averages_cover_the_release_its_label_the_credited_alias_and_the_artist_behind_it()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid labelId = await CreateLabelAsync(client, "Pryda Recordings");
        Guid personId = await CreateArtistAsync(client, "Eric Prydz");
        Guid aliasId = await CreateArtistAsync(client, "Pryda");
        _ = await CreateArtistRelationAsync(client, aliasId, personId, "aliasOf", null, null);
        (Guid releaseId, Guid trackId) = await CreateReleaseWithTrackIdsAsync(client, labelId, aliasId);
        Guid criterionId = await FindOverallCriterionIdAsync(client);
        using HttpResponseMessage ratingResponse = await client.PutAsJsonAsync(
            $"/api/ratings/track/{trackId}/{criterionId}",
            new { value = 4 });

        using HttpResponseMessage response = await client.GetAsync("/api/rating-averages");
        using JsonDocument document = await ReadJsonAsync(response);
        var averages = document.RootElement.GetProperty("items")
            .EnumerateArray()
            .ToDictionary(item => item.GetProperty("targetId").GetGuid());

        Assert.Equal(HttpStatusCode.OK, ratingResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("release", averages[releaseId].GetProperty("targetType").GetString());
        Assert.Equal("label", averages[labelId].GetProperty("targetType").GetString());
        Guid[] targetIds = [releaseId, labelId, aliasId, personId];
        Assert.All(
            targetIds,
            targetId =>
            {
                Assert.Equal(4m, averages[targetId].GetProperty("average").GetDecimal());
                Assert.Equal(1, averages[targetId].GetProperty("ratedTrackCount").GetInt32());
                Assert.Equal(criterionId, averages[targetId].GetProperty("criterionId").GetGuid());
            });
    }
}
