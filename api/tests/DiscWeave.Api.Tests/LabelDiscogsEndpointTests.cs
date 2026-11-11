using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Api.Features.Labels;
using DiscWeave.Application.ExternalMetadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed class LabelDiscogsEndpointTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>, IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), "discweave-label-catalog-" + Guid.NewGuid());

    [Fact(DisplayName = "Label catalog selection is verified and paged results remain unmatched without identity evidence")]
    public async Task Label_catalog_selection_is_verified_and_paged_results_remain_unmatched_without_identity_evidence()
    {
        var provider = new Provider();
        await using ApiTestHost host = await HostAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string root = await LabelRootAsync(client);
        LabelDiscogsPreferences? empty = await client.GetFromJsonAsync<LabelDiscogsPreferences>(root + "/preferences");
        Assert.Null(empty!.DiscogsLabelId);
        using HttpResponseMessage search = await client.GetAsync(root + "/search?query=Label");
        Assert.Equal(HttpStatusCode.OK, search.StatusCode);
        using HttpResponseMessage saved = await client.PutAsJsonAsync(root + "/preferences", new { discogsLabelId = "123", prefixes = (string[])[" ABC ", "abc"] });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal("ABC", Assert.Single((await saved.Content.ReadFromJsonAsync<LabelDiscogsPreferences>())!.Prefixes));
        Assert.Equal(1, provider.Lookups);
        LabelDiscogsCatalogResponse? catalog = await client.GetFromJsonAsync<LabelDiscogsCatalogResponse>(root + "/catalog?page=2");
        Assert.Equal(2, catalog!.Page);
        Assert.Equal("unmatched", Assert.Single(catalog.Items).MatchKind);
        Assert.Equal("ABC 01", catalog.Items[0].CatalogNumber);
        using HttpResponseMessage release = await client.PostAsJsonAsync("/api/releases", new { title = "Album", artistCredits = new[] { new { name = "Artist", role = "mainArtist" } } });
        _ = release.EnsureSuccessStatusCode();
        using var releaseJson = JsonDocument.Parse(await release.Content.ReadAsStringAsync());
        Guid releaseId = releaseJson.RootElement.GetProperty("id").GetGuid();
        await host.SetReviewReleaseSourceAsync(releaseId, "release", "456");
        LabelDiscogsCatalogResponse? matched = await client.GetFromJsonAsync<LabelDiscogsCatalogResponse>(root + "/catalog?page=2");
        Assert.Equal("exact", matched!.Items[0].MatchKind);
        Assert.Equal(releaseId, Assert.Single(matched.Items[0].Matches).ReleaseId);
        using HttpResponseMessage cleared = await client.PutAsJsonAsync(root + "/preferences", new { discogsLabelId = (string?)null, prefixes = Array.Empty<string>() });
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);
        Assert.Equal(1, provider.Lookups);
        using HttpResponseMessage noSelection = await client.GetAsync(root + "/catalog");
        Assert.Equal(HttpStatusCode.Conflict, noSelection.StatusCode);
    }

    [Fact(DisplayName = "Foreign collection requests fail before calling Discogs or reading preferences")]
    public async Task Foreign_collection_requests_fail_before_calling_Discogs_or_reading_preferences()
    {
        var provider = new Provider();
        await using ApiTestHost host = await HostAsync(provider);
        HttpClient owner = await host.CreateAuthenticatedClientAsync();
        string root = await LabelRootAsync(owner);
        using HttpResponseMessage created = await owner.PostAsJsonAsync("/api/admin/users", new { email = "other-label@example.com", password = "Password1!", isAdmin = false });
        _ = created.EnsureSuccessStatusCode();
        HttpClient other = host.CreateClient();
        using HttpResponseMessage login = await other.PostAsJsonAsync("/api/auth/login", new { email = "other-label@example.com", password = "Password1!" });
        _ = login.EnsureSuccessStatusCode();
        foreach (string suffix in new[] { "/preferences", "/search?query=Label", "/catalog" })
        {
            using HttpResponseMessage foreign = await other.GetAsync(root + suffix);
            Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        }

        using HttpResponseMessage save = await other.PutAsJsonAsync(root + "/preferences", new { discogsLabelId = "123", prefixes = Array.Empty<string>() });
        Assert.Equal(HttpStatusCode.NotFound, save.StatusCode);
        Assert.Equal(0, provider.Lookups);
        Assert.Equal(0, provider.Searches);
        using HttpResponseMessage anonymous = await host.CreateClient().GetAsync(root + "/preferences");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }

    [Fact(DisplayName = "Invalid input does not invoke the provider")]
    public async Task Invalid_input_does_not_invoke_the_provider()
    {
        var provider = new Provider();
        await using ApiTestHost host = await HostAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        string root = await LabelRootAsync(client);
        using HttpResponseMessage invalid = await client.PutAsJsonAsync(root + "/preferences", new { discogsLabelId = "https://evil.invalid", prefixes = (string[])["ABC"] });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        using HttpResponseMessage noPrefixes = await client.PutAsJsonAsync(root + "/preferences", new { discogsLabelId = "123" });
        Assert.Equal(HttpStatusCode.BadRequest, noPrefixes.StatusCode);
        using HttpResponseMessage page = await client.GetAsync(root + "/catalog?page=0");
        Assert.Equal(HttpStatusCode.BadRequest, page.StatusCode);
        using HttpResponseMessage query = await client.GetAsync(root + "/search?query=");
        Assert.Equal(HttpStatusCode.BadRequest, query.StatusCode);
        Assert.Equal(0, provider.Lookups);
        Assert.Equal(0, provider.Searches);
    }

    private Task<ApiTestHost> HostAsync(Provider provider) => ApiTestHost.CreateAsync(sqlite,
        new Dictionary<string, string?> { ["DiscWeave:LabelDiscogsPreferencesDirectory"] = _directory }, configureServices: services =>
        {
            _ = services.RemoveAll<IDiscogsLabelCatalogProvider>();
            _ = services.AddSingleton<IDiscogsLabelCatalogProvider>(provider);
        });

    private static async Task<string> LabelRootAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/labels", new { name = "Label" });
        _ = response.EnsureSuccessStatusCode();
        LabelResponse label = (await response.Content.ReadFromJsonAsync<LabelResponse>())!;
        return $"/api/labels/{label.Id}/discogs";
    }

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }

    private sealed class Provider : IDiscogsLabelCatalogProvider
    {
        public int Lookups { get; private set; }
        public int Searches { get; private set; }
        public Task<ExternalMetadataResult<DiscogsLabelCandidate>> GetLabelAsync(string externalId, CancellationToken cancellationToken)
        {
            Lookups++;
            return Task.FromResult(new ExternalMetadataResult<DiscogsLabelCandidate>(new DiscogsLabelCandidate("123", "Label")));
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<DiscogsLabelCandidate>>> SearchLabelsAsync(string query, CancellationToken cancellationToken)
        {
            Searches++;
            return Task.FromResult(new ExternalMetadataResult<ExternalMetadataSearchResult<DiscogsLabelCandidate>>(new ExternalMetadataSearchResult<DiscogsLabelCandidate>([new("123", "Label")], 1)));
        }

        public Task<ExternalMetadataResult<DiscogsLabelCatalogPage>> GetLabelReleasesAsync(string externalId, int page, CancellationToken cancellationToken)
        {
            return Task.FromResult(new ExternalMetadataResult<DiscogsLabelCatalogPage>(new DiscogsLabelCatalogPage([new("456", "ABC 01", "Artist", "Album", 2000, "LP")], page, 100, 101, 2)));
        }
    }
}
