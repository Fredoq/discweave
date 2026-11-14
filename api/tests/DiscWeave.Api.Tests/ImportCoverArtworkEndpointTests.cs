using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ImportCoverArtworkEndpointTests : ImportCoverArtworkTestBase, IClassFixture<SqliteFixture>
{
    public ImportCoverArtworkEndpointTests(SqliteFixture sqlite) : base(sqlite)
    {
    }

    [Fact]
    public async Task Import_cover_candidates_preserve_owned_bytes_after_original_images_are_removed()
    {
        using var root = new CoverTestDirectory();
        string folder = Path.Combine(root.Source, AlbumFolder);
        _ = Directory.CreateDirectory(folder);
        await File.WriteAllBytesAsync(Path.Combine(folder, "cover.png"), CoverBytes());
        await File.WriteAllBytesAsync(Path.Combine(folder, "front.png"), FrontBytes());
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        string route = ArtworkRoute(scan);
        JsonElement artwork = await GetArtworkAsync(client, route);
        Assert.Equal(2, artwork.GetProperty("candidates").GetArrayLength());
        Assert.Equal("cover.png", artwork.GetProperty("selected").GetProperty("fileName").GetString());
        Assert.Equal(CoverBytes(), await File.ReadAllBytesAsync(Path.Combine(folder, "cover.png")));
        Directory.Delete(folder, recursive: true);
        Guid frontId = FrontId(artwork);
        await AssertImageAsync(client, route + $"/candidates/{frontId}", FrontBytes());
        JsonElement selected = await SelectAsync(client, route, frontId);
        Assert.NotEqual(artwork.GetProperty("selected").GetProperty("url").GetString(), selected.GetProperty("selected").GetProperty("url").GetString());
        JsonElement reopened = await GetArtworkAsync(client, route);
        await AssertImageAsync(client, reopened.GetProperty("selected").GetProperty("url").GetString(), FrontBytes());
        Guid releaseId = await ConfirmAsync(client, scan);
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", FrontBytes());
    }

    [Fact]
    public async Task Explicit_no_cover_survives_a_stale_draft_save_and_confirmation()
    {
        using var root = new CoverTestDirectory();
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source);
        _ = await SelectAsync(client, ArtworkRoute(scan), null);
        using HttpResponseMessage saved = await client.PutAsJsonAsync(DraftRoute(scan), scan.GetProperty("drafts")[0]);
        _ = await JsonAsync(saved, HttpStatusCode.OK);
        JsonElement artwork = await GetArtworkAsync(client, ArtworkRoute(scan));
        Assert.Equal(JsonValueKind.Null, artwork.GetProperty("selected").ValueKind);
        Assert.Equal(2, artwork.GetProperty("candidates").GetArrayLength());
        Guid releaseId = await ConfirmAsync(client, scan);
        using HttpResponseMessage missing = await client.GetAsync($"/api/releases/{releaseId}/cover-image");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task Import_cover_uploads_keep_an_owned_copy_and_reject_invalid_replacements()
    {
        using var root = new CoverTestDirectory();
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source, includeCovers: false);
        string route = ArtworkRoute(scan);
        JsonElement empty = await GetArtworkAsync(client, route);
        Assert.Empty(empty.GetProperty("candidates").EnumerateArray());
        using MultipartFormDataContent upload = Upload(FrontBytes());
        using HttpResponseMessage response = await client.PostAsync(route, upload);
        JsonElement uploaded = await JsonAsync(response, HttpStatusCode.OK);
        Assert.Equal("manual.png", uploaded.GetProperty("selected").GetProperty("fileName").GetString());
        Assert.Equal(JsonValueKind.Null, uploaded.GetProperty("selected").GetProperty("sourcePath").ValueKind);
        _ = Assert.Single(uploaded.GetProperty("candidates").EnumerateArray());
        using MultipartFormDataContent invalid = Upload([1, 2, 3]);
        using HttpResponseMessage rejected = await client.PostAsync(route, invalid);
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        JsonElement retained = await GetArtworkAsync(client, route);
        Assert.Equal(uploaded.GetProperty("selected").GetProperty("url").GetString(), retained.GetProperty("selected").GetProperty("url").GetString());
        Guid releaseId = await ConfirmAsync(client, scan);
        await AssertImageAsync(client, $"/api/releases/{releaseId}/cover-image", FrontBytes());
    }

    [Fact]
    public async Task Names_only_scans_expose_no_cover_previews_or_source_file_fallback()
    {
        using var root = new CoverTestDirectory();
        string folder = Path.Combine(root.Source, AlbumFolder);
        _ = Directory.CreateDirectory(folder);
        string source = Path.Combine(folder, "cover.png");
        await File.WriteAllBytesAsync(source, CoverBytes());
        await using ApiTestHost host = await CreateHostAsync(root);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        JsonElement scan = await ScanAsync(client, root.Source, namesOnly: true);
        JsonElement artwork = await GetArtworkAsync(client, ArtworkRoute(scan));
        Assert.Empty(artwork.GetProperty("candidates").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, artwork.GetProperty("selected").ValueKind);
        Assert.NotEmpty(artwork.GetProperty("warnings").EnumerateArray());
        using HttpResponseMessage preview = await client.GetAsync(ArtworkRoute(scan) + "/image");
        Assert.Equal(HttpStatusCode.NotFound, preview.StatusCode);
        Guid releaseId = await ConfirmAsync(client, scan);
        using HttpResponseMessage missing = await client.GetAsync($"/api/releases/{releaseId}/cover-image");
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
        Assert.Equal(CoverBytes(), await File.ReadAllBytesAsync(source));
    }
}
