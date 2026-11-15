using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReleaseExternalCoverArtworkEndpointTests : ImportCoverArtworkTestBase, IClassFixture<SqliteFixture>
{
    public ReleaseExternalCoverArtworkEndpointTests(SqliteFixture sqlite) : base(sqlite)
    {
    }

    [Fact]
    public async Task Release_artwork_search_and_preview_leave_the_existing_cover_unchanged()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeProvider();
        var storage = new FaultStorage(root.Storage);
        await using ApiTestHost host = await CreateReleaseHostAsync(root, provider, storage);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client);
        _ = await UploadOriginalAsync(client, releaseId);
        string route = Route(releaseId);
        using HttpResponseMessage search = await client.GetAsync(route + "/search?artist=Steven%20Julien&title=Fallen&catalogNumber=AA01&barcode=123456");
        JsonElement found = await JsonAsync(search, HttpStatusCode.OK);
        _ = Assert.Single(found.GetProperty("items").EnumerateArray());
        Assert.Equal("Steven Julien", provider.Query?.Artist);
        Assert.Equal("Fallen", provider.Query?.Title);
        Assert.Equal("AA01", provider.Query?.CatalogNumber);
        Assert.Equal("123456", provider.Query?.Barcode);
        using HttpResponseMessage editions = await client.GetAsync(route + $"/releases/{FakeProvider.EditionId}");
        JsonElement images = await JsonAsync(editions, HttpStatusCode.OK);
        _ = Assert.Single(images.GetProperty("items").EnumerateArray());
        await AssertImageAsync(client, route + $"/releases/{FakeProvider.EditionId}/images/12345", FrontBytes());
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", CoverBytes());
        _ = Assert.Single(storage.SavedKeys);
    }

    [Fact]
    public async Task Release_artwork_endpoints_authorize_the_collection_before_contacting_a_provider()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeProvider();
        var storage = new FaultStorage(root.Storage);
        await using ApiTestHost host = await CreateReleaseHostAsync(root, provider, storage);
        HttpClient owner = await host.CreateAuthenticatedClientAsync();
        HttpClient other = await CreateOtherClientAsync(host, owner);
        Guid releaseId = await CreateReleaseAsync(owner);
        string route = Route(releaseId);
        foreach (string url in new[] { route + "/search?artist=A&title=B", route + $"/releases/{FakeProvider.EditionId}", route + $"/releases/{FakeProvider.EditionId}/images/12345" })
        {
            using HttpResponseMessage denied = await other.GetAsync(url);
            Assert.Equal(HttpStatusCode.NotFound, denied.StatusCode);
        }
        using HttpResponseMessage selection = await other.PostAsJsonAsync(route + "/external-selection", Selection());
        Assert.Equal(HttpStatusCode.NotFound, selection.StatusCode);
        Assert.Equal(0, provider.Calls);
        Assert.Empty(storage.SavedKeys);
    }

    [Fact]
    public async Task Selected_release_artwork_owns_its_bytes_and_preserves_external_provenance()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeProvider();
        var storage = new FaultStorage(root.Storage);
        await using ApiTestHost host = await CreateReleaseHostAsync(root, provider, storage);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid releaseId = await CreateReleaseAsync(client);
        _ = await UploadOriginalAsync(client, releaseId);
        string oldKey = Assert.Single(storage.SavedKeys);
        using HttpResponseMessage selection = await client.PostAsJsonAsync(Route(releaseId) + "/external-selection", Selection());
        JsonElement cover = await JsonAsync(selection, HttpStatusCode.OK);
        Assert.Equal("coverArtArchive", cover.GetProperty("sourceType").GetString());
        provider.Fail = true;
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", FrontBytes());
        using HttpResponseMessage response = await client.GetAsync($"/api/releases/{releaseId}/cover-image/provenance");
        JsonElement provenance = (await JsonAsync(response, HttpStatusCode.OK)).GetProperty("provenance");
        Assert.Equal("coverArtArchive", provenance.GetProperty("provider").GetString());
        Assert.Equal(FakeProvider.EditionId, provenance.GetProperty("releaseId").GetGuid());
        Assert.Equal("12345", provenance.GetProperty("imageId").GetString());
        Assert.Equal($"https://coverartarchive.org/release/{FakeProvider.EditionId}", provenance.GetProperty("sourceUrl").GetString());
        Assert.Equal(64, provenance.GetProperty("sha256").GetString()?.Length);
        Assert.Contains(oldKey, storage.DeleteAttempts);
        Assert.False(File.Exists(Path.Combine(root.Storage, oldKey)));
    }
}
