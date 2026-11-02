using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class RecommendedReleaseImportTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Recommended_release_blocks_known_other_edition_but_keeps_a_distinct_recording(bool remix)
    {
        FakeExternalMetadataProvider provider = Provider(relatedSources:
            [new ExternalMetadataSource("discogs", "master", "99", "https://www.discogs.com/master/99", "Discogs")]);
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite,
            services => FakeExternalMetadataProvider.Register(services, provider));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonObject session = await CreateDraftAsync(client);
        JsonObject draft = session["drafts"]![0]!.AsObject();
        draft["collectionItemIntent"] = new JsonObject
        {
            ["kind"] = "newWanted",
            ["medium"] = new JsonObject { ["kind"] = "digital" }
        };
        string route = $"/api/imports/{session["id"]}/drafts/{draft["id"]}";
        using HttpResponseMessage save = await client.PutAsJsonAsync(route, draft);
        Assert.True(save.IsSuccessStatusCode);
        await host.SeedRecommendedMasterEditionAsync(remix);
        using HttpResponseMessage response = await client.PostAsync($"{route}/confirm", null);
        Assert.Equal(remix ? HttpStatusCode.OK : HttpStatusCode.BadRequest, response.StatusCode);
    }
}
