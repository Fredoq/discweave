using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ImportExternalCoverArtworkEndpointTests
{
    [Fact]
    public async Task External_cover_endpoints_authorize_the_draft_before_calling_any_provider()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider();
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider);
        HttpClient owner = await host.CreateAuthenticatedClientAsync();
        HttpClient other = await CreateOtherClientAsync(host, owner);
        JsonElement scan = await ScanAsync(owner, root.Source);
        string route = ArtworkRoute(scan);
        foreach (string url in new[] { route + "/search?artist=Steven&title=Fallen", route + $"/releases/{FakeCoverProvider.ReleaseId}", route + $"/releases/{FakeCoverProvider.ReleaseId}/images/{FakeCoverProvider.ImageId}" })
        {
            using HttpResponseMessage response = await other.GetAsync(url);
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        using HttpResponseMessage selection = await other.PostAsJsonAsync(route + "/external-selection", Selection());
        Assert.Equal(HttpStatusCode.NotFound, selection.StatusCode);
        Assert.Equal(0, provider.Calls);
        _ = await SelectExternalAsync(owner, route);
        Guid releaseId = await ConfirmAsync(owner, scan);
        using HttpResponseMessage provenance = await other.GetAsync($"/api/releases/{releaseId}/cover-image/provenance");
        Assert.Equal(HttpStatusCode.NotFound, provenance.StatusCode);
    }

    [Fact]
    public async Task Explicit_draft_recreation_preserves_the_downloaded_cover_and_its_provenance()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider();
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        _ = await SelectExternalAsync(client, ArtworkRoute(scan));
        provider.FailDownloads = true;
        JsonElement recreated = await RecreateAsync(client, scan, root.Source);
        JsonElement artwork = await GetArtworkAsync(client, ArtworkRoute(recreated));
        AssertProvenance(artwork);
        await AssertImageAsync(client, artwork.GetProperty("selected").GetProperty("url").GetString(), FrontBytes());
        Assert.Equal(1, provider.Calls);
    }

    [Fact]
    public async Task External_cover_selection_preserves_provenance_when_the_local_candidate_budget_is_full()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider();
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanFullBudgetAsync(client, root.Source);
        JsonElement selected = await SelectExternalAsync(client, ArtworkRoute(scan));
        Assert.Equal(32, selected.GetProperty("candidates").GetArrayLength());
        AssertProvenance(selected);
        AssertProvenance(await GetArtworkAsync(client, ArtworkRoute(scan)));
    }

    [Fact]
    public async Task Confirmed_drafts_reject_external_cover_replacement_before_downloading()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider();
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        Guid releaseId = await ConfirmAsync(client, scan);
        using HttpResponseMessage rejected = await client.PostAsJsonAsync(ArtworkRoute(scan) + "/external-selection", Selection());
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        Assert.Equal(0, provider.Calls);
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", CoverBytes());
    }

    [Fact]
    public async Task A_failed_database_save_restores_provenance_for_identical_downloaded_artwork()
    {
        using var root = new CoverTestDirectory();
        var provider = new FakeCoverProvider();
        await using ApiTestHost host = await CreateExternalHostAsync(root, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        string route = ArtworkRoute(scan);
        JsonElement original = await SelectExternalAsync(client, route);
        await host.ExecuteSqlAsync("CREATE TRIGGER reject_cover_update BEFORE UPDATE ON release_import_drafts BEGIN SELECT RAISE(ABORT, 'simulated cover save failure'); END;");
        using HttpResponseMessage failed = await client.PostAsJsonAsync(route + "/external-selection", OtherSelection());
        Assert.Equal(HttpStatusCode.InternalServerError, failed.StatusCode);
        JsonElement retained = await GetArtworkAsync(client, route);
        AssertProvenance(retained);
        Assert.Equal(original.GetProperty("selected").GetProperty("provenance").GetRawText(), retained.GetProperty("selected").GetProperty("provenance").GetRawText());
        await AssertImageAsync(client, retained.GetProperty("selected").GetProperty("url").GetString(), FrontBytes());
    }
}
