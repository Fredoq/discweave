using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class RecommendedReleaseImportTests
{
    [Fact]
    public async Task Recommended_multidisc_release_keeps_provider_order_when_track_numbers_restart()
    {
        FakeExternalMetadataProvider provider = Provider(tracklist:
        [
            new ExternalMetadataReleaseTrack("First", "1", null, [], "1", null),
            new ExternalMetadataReleaseTrack("Second", "2", null, [], "1", null),
            new ExternalMetadataReleaseTrack("Third", "1", null, [], "2", null)
        ], relatedSources: [new ExternalMetadataSource("discogs", "master", "99", "https://www.discogs.com/master/99", "Discogs")]);
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
        using HttpResponseMessage response = await client.PostAsync($"{route}/confirm", null);
        Assert.True(response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync());
        (int _, int _, int _, int _, bool _, int _, int sources) = await host.GetExternalCatalogStateAsync();
        Assert.Equal(2, sources);
        Assert.Equal(1, await host.RecommendedSecondDiscTrackNumberAsync());
    }

    [Fact]
    public async Task Recommended_release_source_cannot_be_rewritten_through_draft_update()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite,
            services => FakeExternalMetadataProvider.Register(services, Provider()));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonObject session = await CreateDraftAsync(client);
        JsonObject draft = session["drafts"]![0]!.AsObject();
        draft["externalSources"]![0]!["externalId"] = "999";
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/imports/{session["id"]}/drafts/{draft["id"]}", draft);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("read_only", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Recommended_release_preflight_fails_when_provider_deletes_the_release()
    {
        FakeExternalMetadataProvider provider = Provider();
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
        provider.ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
            new ExternalMetadataError(ExternalMetadataErrorKind.NotFound, "external_metadata.not_found", "Release was deleted"));
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{session["id"]}/drafts/{draft["id"]}/confirmation-preflight", draft);
        string payload = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, payload);
        JsonObject preflight = JsonNode.Parse(payload)!.AsObject();
        Assert.False(preflight["canConfirm"]!.GetValue<bool>());
        Assert.Contains("external_metadata.not_found", payload);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Recommended_release_provenance_exclusion_is_scoped_to_the_active_collection(bool foreign)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite,
            services => FakeExternalMetadataProvider.Register(services, Provider()));
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
        await host.SeedRecommendedReleaseProvenanceAsync(foreign);
        using HttpResponseMessage response = await client.PostAsync($"{route}/confirm", null);
        string payload = await response.Content.ReadAsStringAsync();
        Assert.Equal(foreign ? HttpStatusCode.OK : HttpStatusCode.BadRequest, response.StatusCode);
        if (!foreign)
        {
            Assert.Contains("import.recommended_release_already_cataloged", payload);
        }
    }
}
