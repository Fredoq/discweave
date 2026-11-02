using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Api.Features.Discover;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed class DiscoverEndpointTests : IClassFixture<SqliteFixture>, IDisposable
{
    private static readonly string[] ReleaseTargetTypes = ["release"];
    private readonly SqliteFixture _sqlite;
    private readonly string _historyDirectory = Path.Combine(Path.GetTempPath(), "discweave-discover-" + Guid.CreateVersion7());

    public DiscoverEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Discover profile uses only Overall ratings and preserves negative and standout opinions")]
    public async Task Discover_profile_uses_only_Overall_ratings_and_preserves_negative_and_standout_opinions()
    {
        await using ApiTestHost host = await CreateHostAsync();
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid liked = await ReleaseAsync(client, "Favorite", "Artist");
        Guid disliked = await ReleaseAsync(client, "Disliked", "Other artist");
        Guid unscored = await ReleaseAsync(client, "Unscored", "Another artist");
        using HttpResponseMessage customResponse = await client.PostAsJsonAsync("/api/rating-criteria", new { code = "energy", name = "Energy", targetTypes = ReleaseTargetTypes });
        using JsonDocument custom = await JsonAsync(customResponse);
        Guid energy = custom.RootElement.GetProperty("id").GetGuid();
        using HttpResponseMessage energyRating = await client.PutAsJsonAsync($"/api/ratings/release/{unscored}/{energy}", new { value = 5 });
        _ = energyRating.EnsureSuccessStatusCode();
        using JsonDocument criteria = await JsonAsync(await client.GetAsync("/api/rating-criteria"));
        Guid overall = criteria.RootElement.GetProperty("items").EnumerateArray().Single(item => item.GetProperty("code").GetString() == "overall").GetProperty("id").GetGuid();
        using HttpResponseMessage likedResponse = await client.PutAsJsonAsync($"/api/ratings/release/{liked}/{overall}", new { value = 5, standout = true });
        using HttpResponseMessage dislikedResponse = await client.PutAsJsonAsync($"/api/ratings/release/{disliked}/{overall}", new { value = 1 });
        _ = likedResponse.EnsureSuccessStatusCode();
        _ = dislikedResponse.EnsureSuccessStatusCode();
        DiscoverProfileResponse? profile = await client.GetFromJsonAsync<DiscoverProfileResponse>("/api/discover/profile?seed=stable");
        Assert.NotNull(profile);
        Assert.Equal(2, profile.Examples.Count);
        Assert.Contains(profile.Examples, example => example.Title == "Favorite" && example.Rating == 5 && example.Standout);
        Assert.Contains(profile.Examples, example => example.Title == "Disliked" && example.Rating == 1);
        Assert.DoesNotContain(profile.Examples, example => example.Title == "Unscored");
        Assert.Null(profile.Context);
        DiscoverProfileResponse? contextual = await client.GetFromJsonAsync<DiscoverProfileResponse>($"/api/discover/profile?releaseId={liked}");
        Assert.Equal("Favorite", contextual?.Context?.Title);
    }

    [Fact(DisplayName = "Discover resolves verified releases once and records explicit feedback")]
    public async Task Discover_resolves_verified_releases_once_and_records_explicit_feedback()
    {
        FakeExternalMetadataProvider provider = Provider();
        await using ApiTestHost host = await CreateHostAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        DiscoverResult first = await GenerateAsync(client);
        DiscoverRelease release = Assert.Single(first.Items);
        Assert.Equal("123", release.ExternalId);
        Assert.Equal("https://www.discogs.com/release/123", release.SourceUrl);
        Assert.StartsWith("https://music.apple.com/search?term=", release.AppleMusicSearchUrl);
        Assert.Equal(1, provider.LastReleaseSearchQuery?.Limit);
        DiscoverProfileResponse? nextProfile = await client.GetFromJsonAsync<DiscoverProfileResponse>("/api/discover/profile");
        Assert.Equal("New release", Assert.Single(nextProfile!.Avoid).Title);
        using HttpResponseMessage feedback = await client.PostAsJsonAsync("/api/discover/feedback", new { externalId = "123", kind = "alreadyKnow" });
        Assert.Equal(HttpStatusCode.NoContent, feedback.StatusCode);
        Assert.Empty((await GenerateAsync(client)).Items);
        using HttpResponseMessage unknownFeedback = await client.PostAsJsonAsync("/api/discover/feedback", new { externalId = "999", kind = "notInterested" });
        Assert.Equal(HttpStatusCode.NotFound, unknownFeedback.StatusCode);
    }

    [Fact(DisplayName = "Discover excludes existing releases including metadata only catalog entries")]
    public async Task Discover_excludes_existing_releases_including_metadata_only_catalog_entries()
    {
        await using ApiTestHost host = await CreateHostAsync(Provider());
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await ReleaseAsync(client, "New release", "Artist");
        Assert.Empty((await GenerateAsync(client)).Items);
    }

    [Fact(DisplayName = "Discover rejects lookup identity mismatch and never fills missing candidates")]
    public async Task Discover_rejects_lookup_identity_mismatch_and_never_fills_missing_candidates()
    {
        FakeExternalMetadataProvider provider = Provider();
        provider.ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(DiscoverPolicyTests.Release("456", "Artist"));
        await using ApiTestHost host = await CreateHostAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Assert.Empty((await GenerateAsync(client)).Items);
    }

    [Fact(DisplayName = "Discover tokens contexts and feedback stay isolated between collections")]
    public async Task Discover_tokens_contexts_and_feedback_stay_isolated_between_collections()
    {
        await using ApiTestHost host = await CreateHostAsync(Provider());
        HttpClient owner = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await ReleaseAsync(owner, "Private favorite", "Private artist");
        using HttpResponseMessage created = await owner.PostAsJsonAsync("/api/admin/users", new { email = "other-discover@example.com", password = "Password1!", isAdmin = false });
        _ = created.EnsureSuccessStatusCode();
        HttpClient other = host.CreateClient();
        using HttpResponseMessage loggedIn = await other.PostAsJsonAsync("/api/auth/login", new { email = "other-discover@example.com", password = "Password1!" });
        _ = loggedIn.EnsureSuccessStatusCode();
        DiscoverProfileResponse? profile = await owner.GetFromJsonAsync<DiscoverProfileResponse>("/api/discover/profile");
        using HttpResponseMessage stolen = await other.PostAsJsonAsync("/api/discover/resolve", new { profileToken = profile!.ProfileToken, leads = new[] { new { artist = "Artist", title = "New release" } } });
        Assert.Equal(HttpStatusCode.Conflict, stolen.StatusCode);
        using HttpResponseMessage foreign = await other.GetAsync($"/api/discover/profile?releaseId={releaseId}");
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        _ = Assert.Single((await GenerateAsync(owner)).Items);
        _ = Assert.Single((await GenerateAsync(other)).Items);
        using HttpResponseMessage feedback = await host.CreateClient().PostAsJsonAsync("/api/discover/feedback", new { externalId = "123", kind = "alreadyKnow" });
        Assert.Equal(HttpStatusCode.Unauthorized, feedback.StatusCode);
    }

    [Fact(DisplayName = "Discover rejects invalid batches and reusing consumed profiles")]
    public async Task Discover_rejects_invalid_batches_and_reusing_consumed_profiles()
    {
        await using ApiTestHost host = await CreateHostAsync(Provider());
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        DiscoverProfileResponse? profile = await client.GetFromJsonAsync<DiscoverProfileResponse>("/api/discover/profile");
        using HttpResponseMessage tooMany = await client.PostAsJsonAsync("/api/discover/resolve", new
        {
            profileToken = profile!.ProfileToken,
            leads = Enumerable.Repeat(new { artist = "Artist", title = "New release" }, 21)
        });
        Assert.Equal(HttpStatusCode.BadRequest, tooMany.StatusCode);
        var request = new { profileToken = profile.ProfileToken, leads = new[] { new { artist = "Artist", title = "New release" } } };
        using HttpResponseMessage first = await client.PostAsJsonAsync("/api/discover/resolve", request);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        using HttpResponseMessage replay = await client.PostAsJsonAsync("/api/discover/resolve", request);
        Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);
    }

    public void Dispose()
    {
        if (Directory.Exists(_historyDirectory))
        {
            Directory.Delete(_historyDirectory, true);
        }
    }

    private Task<ApiTestHost> CreateHostAsync(FakeExternalMetadataProvider? provider = null)
    {
        return ApiTestHost.CreateAsync(_sqlite, new Dictionary<string, string?> { ["DiscWeave:DiscoverHistoryDirectory"] = _historyDirectory },
            configureServices: services => FakeExternalMetadataProvider.Register(services, provider ?? Provider()));
    }

    private static FakeExternalMetadataProvider Provider()
    {
        ExternalMetadataReleaseDetail release = DiscoverPolicyTests.Release("123", "Artist");
        return new FakeExternalMetadataProvider
        {
            ReleaseDetailResult = new ExternalMetadataResult<ExternalMetadataReleaseDetail>(release),
            ReleaseSearchResult = new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
                new ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>(
                    [new ExternalMetadataReleaseCandidate(release.Source, release.Title, release.Artists, release.Year, release.Labels, release.Formats, null, 0, [])], 1))
        };
    }

    private static async Task<Guid> ReleaseAsync(HttpClient client, string title, string artist)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/releases", new { title, artistCredits = new[] { new { name = artist, role = "mainArtist" } } });
        _ = response.EnsureSuccessStatusCode();
        using JsonDocument document = await JsonAsync(response);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<DiscoverResult> GenerateAsync(HttpClient client)
    {
        DiscoverProfileResponse? profile = await client.GetFromJsonAsync<DiscoverProfileResponse>("/api/discover/profile");
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/discover/resolve", new { profileToken = profile!.ProfileToken, leads = new[] { new { artist = "Artist", title = "New release" } } });
        _ = response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<DiscoverResult>())!;
    }

    private static async Task<JsonDocument> JsonAsync(HttpResponseMessage response)
    {
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }
}
