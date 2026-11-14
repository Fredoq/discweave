using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Api.Features.Imports;

namespace DiscWeave.Api.Tests;

public sealed partial class ImportCoverArtworkEndpointTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Explicit_draft_recreation_retains_the_previous_cover_decision(bool noCover)
    {
        using var root = new CoverTestDirectory();
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        JsonElement artwork = await GetArtworkAsync(client, ArtworkRoute(scan));
        _ = await SelectAsync(client, ArtworkRoute(scan), noCover ? null : FrontId(artwork));
        JsonElement recreated = await RecreateAsync(client, scan, root.Source);
        Assert.NotEqual(scan.GetProperty("drafts")[0].GetProperty("id").GetGuid(), recreated.GetProperty("drafts")[0].GetProperty("id").GetGuid());
        JsonElement retained = await GetArtworkAsync(client, ArtworkRoute(recreated));
        Assert.Equal(2, retained.GetProperty("candidates").GetArrayLength());
        if (noCover)
        {
            Assert.Equal(JsonValueKind.Null, retained.GetProperty("selected").ValueKind);
            Assert.Equal(JsonValueKind.Null, recreated.GetProperty("drafts")[0].GetProperty("coverPath").ValueKind);
        }
        else
        {
            await AssertImageAsync(client, retained.GetProperty("selected").GetProperty("url").GetString(), FrontBytes());
        }
    }

    [Fact]
    public async Task Draft_recreation_waits_for_an_active_artwork_mutation_and_retains_its_snapshot()
    {
        using var root = new CoverTestDirectory();
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        JsonElement artwork = await GetArtworkAsync(client, ArtworkRoute(scan));
        _ = await SelectAsync(client, ArtworkRoute(scan), FrontId(artwork));
        IAsyncDisposable mutationLock = await ReleaseImportConfirmationService.AcquireDraftMutationLockAsync(host.DefaultCollectionId,
            scan.GetProperty("id").GetGuid(), scan.GetProperty("drafts")[0].GetProperty("id").GetGuid(), CancellationToken.None);
        Task<JsonElement> pending;
        try
        {
            pending = RecreateAsync(client, scan, root.Source);
            await Task.Delay(150);
            Assert.False(pending.IsCompleted);
        }
        finally
        {
            await mutationLock.DisposeAsync();
        }

        JsonElement recreated = await pending.WaitAsync(TimeSpan.FromSeconds(10));
        JsonElement retained = await GetArtworkAsync(client, ArtworkRoute(recreated));
        await AssertImageAsync(client, retained.GetProperty("selected").GetProperty("url").GetString(), FrontBytes());
    }

    [Fact]
    public async Task Cover_artwork_endpoints_reject_foreign_collections_and_foreign_draft_candidates()
    {
        using var root = new CoverTestDirectory();
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient owner = await host.CreateAuthenticatedClientAsync();
        HttpClient other = await CreateOtherClientAsync(host, owner);
        JsonElement scan = await ScanAsync(owner, root.Source);
        string route = ArtworkRoute(scan);
        Guid candidateId = FrontId(await GetArtworkAsync(owner, route));
        foreach (string url in new[] { route, route + "/image", route + $"/candidates/{candidateId}" })
        {
            using HttpResponseMessage inaccessible = await other.GetAsync(url);
            Assert.Equal(HttpStatusCode.NotFound, inaccessible.StatusCode);
        }

        using HttpResponseMessage selection = await other.PutAsJsonAsync(route, new { candidateId });
        Assert.Equal(HttpStatusCode.NotFound, selection.StatusCode);
        using MultipartFormDataContent upload = Upload(FrontBytes());
        using HttpResponseMessage uploaded = await other.PostAsync(route, upload);
        Assert.Equal(HttpStatusCode.NotFound, uploaded.StatusCode);
        JsonElement ownScan = await ScanAsync(other, root.Source);
        using HttpResponseMessage foreign = await other.PutAsJsonAsync(ArtworkRoute(ownScan), new { candidateId });
        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        using HttpResponseMessage foreignPreview = await other.GetAsync(ArtworkRoute(ownScan) + $"/candidates/{candidateId}");
        Assert.Equal(HttpStatusCode.NotFound, foreignPreview.StatusCode);
    }

    [Fact]
    public async Task Confirmed_drafts_reject_artwork_changes_without_changing_the_catalog_cover()
    {
        using var root = new CoverTestDirectory();
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        Guid releaseId = await ConfirmAsync(client, scan);
        string route = ArtworkRoute(scan);
        JsonElement artwork = await GetArtworkAsync(client, route);
        Assert.False(artwork.GetProperty("canEdit").GetBoolean());
        using HttpResponseMessage remove = await client.PutAsJsonAsync(route, new { candidateId = (Guid?)null });
        Assert.Equal(HttpStatusCode.BadRequest, remove.StatusCode);
        using MultipartFormDataContent upload = Upload(FrontBytes());
        using HttpResponseMessage uploaded = await client.PostAsync(route, upload);
        Assert.Equal(HttpStatusCode.BadRequest, uploaded.StatusCode);
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", CoverBytes());
    }

    [Fact]
    public async Task Deleting_an_abandoned_session_removes_only_owned_candidate_artifacts()
    {
        using var root = new CoverTestDirectory();
        string folder = Path.Combine(root.Source, AlbumFolder);
        _ = Directory.CreateDirectory(folder);
        string source = Path.Combine(folder, "cover.png");
        await File.WriteAllBytesAsync(source, CoverBytes());
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        Assert.NotEmpty(Directory.GetFiles(root.Storage, "*", SearchOption.AllDirectories));
        using var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/imports/{scan.GetProperty("id").GetGuid()}");
        request.Headers.Add("X-DiscWeave-Confirm-Delete", "delete-abandoned-import-session");
        using HttpResponseMessage deleted = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Empty(Directory.GetFiles(root.Storage, "*", SearchOption.AllDirectories));
        Assert.Equal(CoverBytes(), await File.ReadAllBytesAsync(source));
    }

    [Fact]
    public async Task Reimport_keeps_an_existing_release_cover_instead_of_applying_the_draft_suggestion()
    {
        using var root = new CoverTestDirectory();
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        Guid releaseId = await ConfirmAsync(client, scan);
        using MultipartFormDataContent upload = Upload(FrontBytes());
        using HttpResponseMessage replaced = await client.PutAsync($"/api/releases/{releaseId}/cover-image", upload);
        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        JsonElement reimport = await ScanAsync(client, root.Source);
        Assert.Equal(releaseId, await ConfirmAsync(client, reimport));
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", FrontBytes());
    }

    [Fact]
    public async Task A_local_upload_remains_selectable_when_the_candidate_review_limit_is_full()
    {
        using var root = new CoverTestDirectory();
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanFullBudgetAsync(client, root.Source);
        using MultipartFormDataContent upload = Upload(FrontBytes());
        using HttpResponseMessage response = await client.PostAsync(ArtworkRoute(scan), upload);
        JsonElement selected = await JsonAsync(response, HttpStatusCode.OK);
        Assert.Equal(32, selected.GetProperty("candidates").GetArrayLength());
        Assert.Equal(JsonValueKind.Null, selected.GetProperty("selected").GetProperty("id").ValueKind);
        await AssertImageAsync(client, selected.GetProperty("selected").GetProperty("url").GetString(), FrontBytes());
    }

    [Fact]
    public async Task A_full_scan_without_owned_image_bytes_never_reads_the_source_cover_during_confirmation()
    {
        using var root = new CoverTestDirectory();
        string folder = Path.Combine(root.Source, AlbumFolder);
        _ = Directory.CreateDirectory(folder);
        string source = Path.Combine(folder, "cover.png");
        await File.WriteAllBytesAsync(source, CoverBytes());
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", ScanPayload(root.Source,
            [AudioFile(root.Source), CoverFile(root.Source, "cover.png", CoverBytes(), namesOnly: true)]));
        JsonElement scan = await JsonAsync(response, HttpStatusCode.Created);
        JsonElement artwork = await GetArtworkAsync(client, ArtworkRoute(scan));
        Assert.Equal(JsonValueKind.Null, artwork.GetProperty("selected").ValueKind);
        Guid releaseId = await ConfirmAsync(client, scan);
        using HttpResponseMessage missing = await client.GetAsync($"/api/releases/{releaseId}/cover-image");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(CoverBytes(), await File.ReadAllBytesAsync(source));
    }
}
