using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ImportExternalCoverArtworkEndpointTests : ImportCoverArtworkTestBase, IClassFixture<SqliteFixture>
{
    public ImportExternalCoverArtworkEndpointTests(SqliteFixture sqlite) : base(sqlite)
    {
    }

    [Fact]
    public async Task External_cover_discovery_forwards_explicit_search_fields_and_proxies_front_previews()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider();
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        string route = ArtworkRoute(scan);
        using HttpResponseMessage search = await client.GetAsync(route + "/search?artist=Steven%20Julien&title=Fallen&catalogNumber=AA01&barcode=123456");
        JsonElement found = await JsonAsync(search, HttpStatusCode.OK);
        _ = Assert.Single(found.GetProperty("items").EnumerateArray());
        Assert.Equal("Steven Julien", provider.Query?.Artist);
        Assert.Equal("Fallen", provider.Query?.Title);
        Assert.Equal("AA01", provider.Query?.CatalogNumber);
        Assert.Equal("123456", provider.Query?.Barcode);
        using HttpResponseMessage covers = await client.GetAsync(route + $"/releases/{FakeCoverProvider.ReleaseId}");
        JsonElement candidates = await JsonAsync(covers, HttpStatusCode.OK);
        _ = Assert.Single(candidates.GetProperty("items").EnumerateArray());
        await AssertImageAsync(client, route + $"/releases/{FakeCoverProvider.ReleaseId}/images/{FakeCoverProvider.ImageId}", FrontBytes());
        Assert.True(provider.LastDownloadWasPreview);
        JsonElement unchanged = await GetArtworkAsync(client, route);
        Assert.Equal("cover.png", unchanged.GetProperty("selected").GetProperty("fileName").GetString());
    }

    [Fact]
    public async Task External_cover_selection_stores_owned_bytes_and_confirms_their_source_provenance()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider();
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        JsonElement selected = await SelectExternalAsync(client, ArtworkRoute(scan));
        AssertProvenance(selected);
        Assert.False(provider.LastDownloadWasPreview);
        provider.FailDownloads = true;
        await AssertImageAsync(client, selected.GetProperty("selected").GetProperty("url").GetString(), FrontBytes());
        Guid releaseId = await ConfirmAsync(client, scan);
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", FrontBytes());
        using HttpResponseMessage release = await client.GetAsync($"/api/releases/{releaseId}");
        JsonElement detail = await JsonAsync(release, HttpStatusCode.OK);
        Assert.Equal("coverArtArchive", detail.GetProperty("coverImage").GetProperty("sourceType").GetString());
        using HttpResponseMessage response = await client.GetAsync($"/api/releases/{releaseId}/cover-image/provenance");
        JsonElement stored = (await JsonAsync(response, HttpStatusCode.OK)).GetProperty("provenance");
        JsonElement original = selected.GetProperty("selected").GetProperty("provenance");
        Assert.Equal(original.GetProperty("sourceUrl").GetString(), stored.GetProperty("sourceUrl").GetString());
        Assert.Equal(original.GetProperty("sha256").GetString(), stored.GetProperty("sha256").GetString());
    }

    [Fact]
    public async Task Failed_external_cover_downloads_retain_the_existing_selection()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider { FailDownloads = true };
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        string route = ArtworkRoute(scan);
        JsonElement before = await GetArtworkAsync(client, route);
        using HttpResponseMessage failed = await client.PostAsJsonAsync(route + "/external-selection", Selection());
        Assert.Equal(HttpStatusCode.BadRequest, failed.StatusCode);
        JsonElement after = await GetArtworkAsync(client, route);
        Assert.Equal(before.GetProperty("selected").GetProperty("url").GetString(), after.GetProperty("selected").GetProperty("url").GetString());
    }
}
