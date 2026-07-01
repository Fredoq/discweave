using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportDiscogsProvenanceTests : IClassFixture<SqliteFixture>
{
    private static readonly DateTimeOffset DiscogsAppliedAt = new(2026, 6, 1, 12, 0, 0, TimeSpan.Zero);
    private readonly SqliteFixture _sqlite;

    public DesktopImportDiscogsProvenanceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Desktop import confirmation preserves Discogs release source")]
    public async Task Desktop_import_confirmation_preserves_discogs_release_source()
    {
        using var root = TempImportRoot.Create();
        string releaseDirectory = Path.Combine(root.Path, "[ORB 01, 1991] The Orb - Adventures");
        _ = Directory.CreateDirectory(releaseDirectory);
        string audioPath = Path.Combine(releaseDirectory, "01 Huge.flac");
        string coverPath = Path.Combine(releaseDirectory, "cover.jpg");
        await File.WriteAllTextAsync(audioPath, "flac");
        await File.WriteAllTextAsync(coverPath, "cover");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument scan = await PostScanAsync(client, root.Path, audioPath, coverPath);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        JsonElement draft = scan.RootElement.GetProperty("drafts")[0];
        Guid draftId = draft.GetProperty("id").GetGuid();
        Guid trackId = draft.GetProperty("tracks")[0].GetProperty("id").GetGuid();

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}",
            ReviewedDraftPayloadWithSource(trackId));
        using JsonDocument update = await ReadJsonAsync(updateResponse);

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        AssertSource(update.RootElement.GetProperty("drafts")[0].GetProperty("externalSources")[0]);
        JsonElement artistCreditSource = update.RootElement
            .GetProperty("drafts")[0]
            .GetProperty("artistCredits")[0]
            .GetProperty("externalSource");
        Assert.Equal("artist", artistCreditSource.GetProperty("resourceType").GetString());
        Assert.Equal("111", artistCreditSource.GetProperty("externalId").GetString());

        using HttpResponseMessage confirmResponse = await client.PostAsync(
            $"/api/imports/{sessionId}/drafts/{draftId}/confirm",
            null);
        using JsonDocument confirm = await ReadJsonAsync(confirmResponse);

        Assert.Equal(HttpStatusCode.OK, confirmResponse.StatusCode);
        Assert.Equal("confirmed", confirm.RootElement.GetProperty("drafts")[0].GetProperty("status").GetString());

        using HttpResponseMessage releaseResponse = await client.GetAsync(
            "/api/releases?search=Adventures%20Updated&limit=10&offset=0");
        using JsonDocument releases = await ReadJsonAsync(releaseResponse);

        Assert.Equal(HttpStatusCode.OK, releaseResponse.StatusCode);
        JsonElement release = releases.RootElement.GetProperty("items")[0];
        Assert.Equal("Downtempo", release.GetProperty("genres")[0].GetString());
        AssertSource(release.GetProperty("externalSources")[0]);
    }

    private static object ReviewedDraftPayloadWithSource(Guid trackId)
    {
        return new
        {
            title = "Adventures Updated",
            type = "album",
            catalogNumber = "ORB 01",
            labelName = (string?)null,
            releaseDate = "1991-04-01",
            year = 1991,
            isVariousArtists = false,
            notOnLabel = false,
            artistCredits = new object[]
            {
                new
                {
                    artistId = (Guid?)null,
                    name = "Robin Stone",
                    role = "mainArtist",
                    externalSource = ArtistSource("111")
                }
            },
            artistNames = Array.Empty<string>(),
            labels = new object[]
            {
                new { labelId = (Guid?)null, name = "Big Life", catalogNumber = "BLRLP 5", hasNoCatalogNumber = false }
            },
            selectedArtistIds = Array.Empty<Guid>(),
            genres = new[] { "Downtempo" },
            tags = new[] { "imported" },
            coverPath = (string?)null,
            externalSources = new[] { DiscogsSource() },
            tracks = new object[]
            {
                new
                {
                    id = trackId,
                    position = (int?)1,
                    disc = (string?)null,
                    side = "A",
                    title = "A Huge Ever Growing Pulsating Brain",
                    durationSeconds = (int?)1128,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                }
            }
        };
    }

    private static object ArtistSource(string externalId)
    {
        return new
        {
            providerName = "discogs",
            resourceType = "artist",
            externalId,
            sourceUrl = $"https://www.discogs.com/artist/{externalId}"
        };
    }

    private static object DiscogsSource()
    {
        return new
        {
            providerName = "discogs",
            resourceType = "release",
            externalId = "orb-1991",
            sourceUrl = "https://www.discogs.com/release/orb-1991",
            appliedAt = DiscogsAppliedAt
        };
    }

    private static void AssertSource(JsonElement source)
    {
        Assert.Equal("discogs", source.GetProperty("providerName").GetString());
        Assert.Equal("release", source.GetProperty("resourceType").GetString());
        Assert.Equal("orb-1991", source.GetProperty("externalId").GetString());
        Assert.Equal("https://www.discogs.com/release/orb-1991", source.GetProperty("sourceUrl").GetString());
        Assert.Equal(DiscogsAppliedAt, source.GetProperty("appliedAt").GetDateTimeOffset());
    }

    private static async Task<JsonDocument> PostScanAsync(
        HttpClient client,
        string rootPath,
        string audioPath,
        string coverPath)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = rootPath,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new object[]
                {
                    AudioFile(rootPath, audioPath),
                    CoverFile(rootPath, coverPath)
                }
            });
        JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document;
    }

    private static object AudioFile(string rootPath, string filePath)
    {
        return new
        {
            filePath,
            relativePath = Path.GetRelativePath(rootPath, filePath),
            format = "flac",
            sizeBytes = 10,
            lastModifiedAt = DateTimeOffset.UtcNow,
            audioMetadata = new
            {
                title = (string?)null,
                artists = Array.Empty<string>(),
                albumTitle = (string?)null,
                albumArtists = Array.Empty<string>(),
                catalogNumber = (string?)null,
                releaseDate = (string?)null,
                year = (int?)null,
                durationSeconds = (int?)null,
                trackNumber = (int?)null
            },
            coverArtifact = (object?)null
        };
    }

    private static object CoverFile(string rootPath, string filePath)
    {
        return new
        {
            filePath,
            relativePath = Path.GetRelativePath(rootPath, filePath),
            format = (string?)null,
            sizeBytes = 5,
            lastModifiedAt = DateTimeOffset.UtcNow,
            audioMetadata = (object?)null,
            coverArtifact = new
            {
                fileName = "cover.jpg",
                extension = ".jpg",
                contentType = "image/jpeg",
                sizeBytes = 5,
                contentBase64 = "Y292ZXI="
            }
        };
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        Stream stream = await response.Content.ReadAsStreamAsync();
        return await JsonDocument.ParseAsync(stream);
    }

    private sealed class TempImportRoot : IDisposable
    {
        private TempImportRoot(string path)
        {
            Path = path;
        }

        public string Path { get; }

        public static TempImportRoot Create()
        {
            return new TempImportRoot(Directory.CreateTempSubdirectory("discweave-import-discogs-test-").FullName);
        }

        public void Dispose()
        {
            Directory.Delete(Path, recursive: true);
        }
    }
}
