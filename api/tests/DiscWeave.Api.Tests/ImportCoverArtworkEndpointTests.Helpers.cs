using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

public abstract class ImportCoverArtworkTestBase
{
    protected const string AlbumFolder = "[AA 01, 2016-07-15] Steven Julien - Fallen";
    private readonly SqliteFixture _sqlite;

    protected ImportCoverArtworkTestBase(SqliteFixture sqlite) => _sqlite = sqlite;

    protected static byte[] CoverBytes() => Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=");
    protected static byte[] FrontBytes() => Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    private protected Task<ApiTestHost> CreateHostAsync(CoverTestDirectory root, Action<IServiceCollection>? configure = null) => ApiTestHost.CreateAsync(_sqlite,
        new Dictionary<string, string?> { ["ReleaseCovers:StorageRoot"] = root.Storage }, configureServices: configure);

    protected static object ScanPayload(string root, bool namesOnly = false, bool includeCovers = true)
    {
        List<object> files = [AudioFile(root)];
        if (includeCovers)
        {
            files.Add(CoverFile(root, "cover.png", CoverBytes(), namesOnly));
            files.Add(CoverFile(root, "front.png", FrontBytes(), namesOnly));
        }

        return ScanPayload(root, files, namesOnly);
    }

    protected static object ScanPayload(string root, List<object> files, bool namesOnly = false) => new
    {
        sourceRoot = root,
        scanMode = namesOnly ? "namesOnly" : "full",
        ignoredFileCount = 0,
        diagnostics = Array.Empty<object>(),
        files
    };

    protected static object AudioFile(string root) => new
    {
        filePath = Path.Combine(root, AlbumFolder, "01 Begins.flac"),
        relativePath = AlbumFolder + "/01 Begins.flac",
        format = "flac",
        sizeBytes = 9,
        lastModifiedAt = DateTimeOffset.UnixEpoch,
        contentHash = new string('a', 64),
        audioMetadata = new
        {
            title = "Begins",
            artists = new[] { "Steven Julien" },
            albumTitle = "Fallen",
            albumArtists = new[] { "Steven Julien" },
            releaseDate = "2016-07-15",
            year = 2016,
            durationSeconds = 120,
            trackNumber = 1
        },
        coverArtifact = (object?)null
    };

    protected static object CoverFile(string root, string fileName, byte[] bytes, bool namesOnly = false) => new
    {
        filePath = Path.Combine(root, AlbumFolder, fileName),
        relativePath = AlbumFolder + "/" + fileName,
        format = (string?)null,
        sizeBytes = bytes.Length,
        lastModifiedAt = DateTimeOffset.UnixEpoch,
        contentHash = (string?)null,
        audioMetadata = (object?)null,
        coverArtifact = namesOnly ? null : new
        {
            fileName,
            extension = ".png",
            contentType = "image/png",
            sizeBytes = bytes.Length,
            contentBase64 = Convert.ToBase64String(bytes)
        }
    };

    protected static async Task<JsonElement> ScanAsync(HttpClient client, string root, bool namesOnly = false, bool includeCovers = true)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", ScanPayload(root, namesOnly, includeCovers));
        return await JsonAsync(response, HttpStatusCode.Created);
    }

    protected static string DraftRoute(JsonElement scan) => $"/api/imports/{scan.GetProperty("id").GetGuid()}/drafts/{scan.GetProperty("drafts")[0].GetProperty("id").GetGuid()}";
    protected static string ArtworkRoute(JsonElement scan) => DraftRoute(scan) + "/cover-artwork";

    protected static async Task<JsonElement> GetArtworkAsync(HttpClient client, string route)
    {
        using HttpResponseMessage response = await client.GetAsync(route);
        return await JsonAsync(response, HttpStatusCode.OK);
    }

    protected static async Task<JsonElement> SelectAsync(HttpClient client, string route, Guid? candidateId)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(route, new { candidateId });
        return await JsonAsync(response, HttpStatusCode.OK);
    }

    protected static Guid FrontId(JsonElement artwork) => artwork.GetProperty("candidates").EnumerateArray().Single(candidate => candidate.GetProperty("fileName").GetString() == "front.png").GetProperty("id").GetGuid();

    protected static async Task<JsonElement> JsonAsync(HttpResponseMessage response, HttpStatusCode status)
    {
        string content = await response.Content.ReadAsStringAsync();
        Assert.True(response.StatusCode == status, $"Expected {status}, got {response.StatusCode}: {content}");
        using var document = JsonDocument.Parse(content);
        return document.RootElement.Clone();
    }

    protected static async Task<Guid> ConfirmAsync(HttpClient client, JsonElement scan)
    {
        using HttpResponseMessage response = await client.PostAsync(DraftRoute(scan) + "/confirm", null);
        JsonElement confirmation = await JsonAsync(response, HttpStatusCode.OK);
        return confirmation.GetProperty("drafts")[0].GetProperty("confirmedReleaseId").GetGuid();
    }

    protected static MultipartFormDataContent Upload(byte[] content, string fileName = "manual.png")
    {
        var form = new MultipartFormDataContent();
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        form.Add(file, "file", fileName);
        return form;
    }

    protected static async Task AssertImageAsync(HttpClient client, string? url, byte[] expected)
    {
        using HttpResponseMessage image = await client.GetAsync(url);
        Assert.Equal(HttpStatusCode.OK, image.StatusCode);
        Assert.Equal(expected, await image.Content.ReadAsByteArrayAsync());
    }

    protected static async Task<JsonElement> RecreateAsync(HttpClient client, JsonElement scan, string root)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync($"/api/imports/{scan.GetProperty("id").GetGuid()}/desktop-folder-scans", new
        {
            scan = ScanPayload(root),
            replaceDraftIds = new[] { scan.GetProperty("drafts")[0].GetProperty("id").GetGuid() }
        });
        return await JsonAsync(response, HttpStatusCode.OK);
    }

    protected static async Task<JsonElement> ScanFullBudgetAsync(HttpClient client, string root)
    {
        List<object> files = [AudioFile(root)];
        for (int index = 0; index < 32; index++)
        {
            files.Add(CoverFile(root, $"candidate-{index:00}.png", CoverBytes()));
        }

        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/imports/desktop-folder-scans", ScanPayload(root, files));
        return await JsonAsync(response, HttpStatusCode.Created);
    }

    private protected static async Task<HttpClient> CreateOtherClientAsync(ApiTestHost host, HttpClient owner)
    {
        using HttpResponseMessage create = await owner.PostAsJsonAsync("/api/admin/users", new { email = "cover-reader@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        HttpClient other = host.CreateClient();
        using HttpResponseMessage login = await other.PostAsJsonAsync("/api/auth/login", new { email = "cover-reader@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        return other;
    }

    protected sealed class CoverTestDirectory : IDisposable
    {
        public CoverTestDirectory()
        {
            Root = Path.Combine(Path.GetTempPath(), $"discweave-cover-tests-{Guid.CreateVersion7():N}");
            Source = Path.Combine(Root, "source");
            Storage = Path.Combine(Root, "storage");
            _ = Directory.CreateDirectory(Source);
            _ = Directory.CreateDirectory(Storage);
        }

        public string Root { get; }
        public string Source { get; }
        public string Storage { get; }
        public void Dispose() => Directory.Delete(Root, recursive: true);
    }
}
