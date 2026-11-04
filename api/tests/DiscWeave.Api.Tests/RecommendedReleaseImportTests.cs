using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Nodes;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class RecommendedReleaseImportTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public RecommendedReleaseImportTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact]
    public async Task Recommended_release_requires_medium_and_confirms_only_wanted_without_original_relations()
    {
        FakeExternalMetadataProvider provider = Provider();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite,
            services => FakeExternalMetadataProvider.Register(services, provider));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonObject session = await CreateDraftAsync(client);
        JsonObject draft = session["drafts"]![0]!.AsObject();
        Assert.Null(draft["selectedOriginalBinding"]);
        Assert.Empty(session["relationSuggestions"]!.AsArray());
        Assert.Equal("releaseOnly", draft["tracks"]![0]!["trackMode"]!.GetValue<string>());
        Assert.Equal(ExternalMetadataRequestFreshness.Authoritative, provider.LastReleaseFreshness);
        string route = $"/api/imports/{session["id"]}/drafts/{draft["id"]}";
        using HttpResponseMessage missingMedium = await client.PostAsync($"{route}/confirm", null);
        Assert.Equal(HttpStatusCode.BadRequest, missingMedium.StatusCode);
        Assert.Contains("release_import.collection_item_medium_required", await missingMedium.Content.ReadAsStringAsync());
        draft["collectionItemIntent"] = new JsonObject
        {
            ["kind"] = "newWanted",
            ["medium"] = new JsonObject { ["kind"] = "digital" }
        };
        using HttpResponseMessage save = await client.PutAsJsonAsync(route, draft);
        Assert.True(save.IsSuccessStatusCode, await save.Content.ReadAsStringAsync());
        using HttpResponseMessage confirm = await client.PostAsync($"{route}/confirm", null);
        Assert.True(confirm.IsSuccessStatusCode, await confirm.Content.ReadAsStringAsync());
        using HttpResponseMessage replay = await client.PostAsync($"{route}/confirm", null);
        Assert.True(replay.IsSuccessStatusCode);
        (int releases, int tracks, int wanted, int relations, bool _, int _, int _) = await host.GetExternalCatalogStateAsync();
        Assert.Equal(1, releases);
        Assert.Equal(0, tracks);
        Assert.Equal(1, wanted);
        Assert.Equal(0, relations);
    }

    [Fact]
    public async Task Recommended_release_draft_replay_is_stable_and_other_id_reusing_key_is_rejected()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite,
            services => FakeExternalMetadataProvider.Register(services, Provider()));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonObject first = await CreateDraftAsync(client);
        JsonObject second = await CreateDraftAsync(client);
        Assert.Equal(first["id"]!.GetValue<string>(), second["id"]!.GetValue<string>());
        using HttpResponseMessage mismatch = await client.PostAsJsonAsync("/api/imports/recommended-release-drafts",
            new { discogsReleaseId = "99", idempotencyKey = "recommendation-test" });
        Assert.Equal(HttpStatusCode.BadRequest, mismatch.StatusCode);
        Assert.Contains("release_import.idempotency_key_reused", await mismatch.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("artist", "12345", "https://www.discogs.com/release/12345")]
    [InlineData("release", "999", "https://www.discogs.com/release/12345")]
    [InlineData("release", "12345", "https://attacker.example/release/12345")]
    public async Task Recommended_release_rejects_mismatching_provider_identity(string resourceType, string id, string url)
    {
        FakeExternalMetadataProvider provider = Provider(resourceType, id, url);
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite,
            services => FakeExternalMetadataProvider.Register(services, provider));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/recommended-release-drafts",
            new { discogsReleaseId = "12345", idempotencyKey = "bad-source" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("import.recommended_release_invalid", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Recommended_release_revalidates_metadata_before_confirmation_and_keeps_catalog_unchanged_on_failure()
    {
        FakeExternalMetadataProvider provider = Provider();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite,
            services => FakeExternalMetadataProvider.Register(services, provider));
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonObject session = await CreateDraftAsync(client);
        JsonObject draft = session["drafts"]![0]!.AsObject();
        string route = $"/api/imports/{session["id"]}/drafts/{draft["id"]}";
        draft["collectionItemIntent"] = new JsonObject
        {
            ["kind"] = "newWanted",
            ["medium"] = new JsonObject { ["kind"] = "digital" }
        };
        using HttpResponseMessage save = await client.PutAsJsonAsync(route, draft);
        Assert.True(save.IsSuccessStatusCode);
        provider.ReleaseDetailResult = Provider(title: "Changed release").ReleaseDetailResult;
        using HttpResponseMessage confirm = await client.PostAsync($"{route}/confirm", null);
        Assert.Equal(HttpStatusCode.BadRequest, confirm.StatusCode);
        Assert.Contains("import.recommended_release_changed", await confirm.Content.ReadAsStringAsync());
        (int releases, int tracks, int wanted, int relations, bool _, int _, int _) = await host.GetExternalCatalogStateAsync();
        Assert.Equal(0, releases);
        Assert.Equal(0, tracks);
        Assert.Equal(0, wanted);
        Assert.Equal(0, relations);
    }

    private static async Task<JsonObject> CreateDraftAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/recommended-release-drafts",
            new { discogsReleaseId = "12345", idempotencyKey = "recommendation-test" });
        string payload = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == HttpStatusCode.Created, payload);
        return JsonNode.Parse(payload)!.AsObject();
    }

    private static FakeExternalMetadataProvider Provider(string resourceType = "release", string id = "12345",
        string url = "https://www.discogs.com/release/12345", string title = "A verified release",
        IReadOnlyList<ExternalMetadataReleaseTrack>? tracklist = null,
        IReadOnlyList<ExternalMetadataSource>? relatedSources = null)
    {
        ExternalMetadataReleaseDetail detail = new(
            new ExternalMetadataSource("discogs", resourceType, id, url, "Discogs"), title,
            ["A test artist"], 2005, null, ["Test label"], ["CD"], "album", [],
            tracklist ?? [new ExternalMetadataReleaseTrack("A recording", "1", TimeSpan.FromSeconds(180), [], "1", null)],
            [], null, [], [], relatedSources: relatedSources);
        return new FakeExternalMetadataProvider("discogs")
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(detail)
        };
    }
}
