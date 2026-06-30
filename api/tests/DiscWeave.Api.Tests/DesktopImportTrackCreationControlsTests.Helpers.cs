using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportTrackCreationControlsTests
{
    private static async Task<Guid> CreateTrackAsync(HttpClient client, string title)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title, genres = Array.Empty<string>(), tags = Array.Empty<string>() });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> PostScanAsync(HttpClient client, string rootPath, params string[] paths)
    {
        return await PostScanAsync(
            client,
            rootPath,
            [.. paths.Select((path, index) => AudioFile(rootPath, path, Path.GetFileNameWithoutExtension(path)[3..], index + 1))]);
    }

    private static async Task<JsonDocument> PostScanAsync(HttpClient client, string rootPath, IReadOnlyList<object> files)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = rootPath,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files
            });
        JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document;
    }

    private static object AudioFile(string rootPath, string filePath, string title, int? trackNumber)
    {
        return new
        {
            filePath,
            relativePath = Path.GetRelativePath(rootPath, filePath),
            format = "flac",
            sizeBytes = new FileInfo(filePath).Length,
            lastModifiedAt = DateTimeOffset.UtcNow,
            audioMetadata = new
            {
                title,
                artists = Array.Empty<string>(),
                albumTitle = (string?)null,
                albumArtists = Array.Empty<string>(),
                catalogNumber = (string?)null,
                releaseDate = (string?)null,
                year = (int?)null,
                durationSeconds = (int?)null,
                trackNumber
            },
            coverArtifact = (object?)null
        };
    }

    private static object ReleaseOnlyDraftUpdatePayload(
        string title,
        bool createCatalogTracks,
        IReadOnlyList<object> tracks)
    {
        return new
        {
            title,
            type = "mix",
            catalogNumber = "DW 71",
            labelName = (string?)null,
            releaseDate = (string?)null,
            year = 2026,
            isVariousArtists = true,
            notOnLabel = true,
            createCatalogTracks,
            coverPath = (string?)null,
            artistNames = Array.Empty<string>(),
            artistCredits = Array.Empty<object>(),
            labels = Array.Empty<object>(),
            selectedArtistIds = Array.Empty<Guid>(),
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>(),
            externalSources = Array.Empty<object>(),
            tracks
        };
    }

    private static object ReleaseOnlyTrackUpdate(Guid draftTrackId, string title, int? position)
    {
        return new
        {
            id = draftTrackId,
            trackMode = "releaseOnly",
            position,
            disc = (string?)null,
            side = (string?)null,
            title,
            durationSeconds = (int?)null,
            artistNames = Array.Empty<string>(),
            artistCredits = Array.Empty<object>(),
            inheritReleaseArtistCredits = false,
            selectedArtistIds = Array.Empty<Guid>(),
            selectedTrackId = (Guid?)null,
            isSkipped = false
        };
    }

    private static object DraftUpdatePayload(
        bool createCatalogTracks,
        Guid introDraftTrackId,
        Guid linkedDraftTrackId,
        Guid linkedTrackId)
    {
        return new
        {
            title = "Room Mix",
            type = "mix",
            catalogNumber = "DW 71",
            labelName = (string?)null,
            releaseDate = (string?)null,
            year = 2026,
            isVariousArtists = true,
            notOnLabel = true,
            createCatalogTracks,
            coverPath = (string?)null,
            artistNames = Array.Empty<string>(),
            artistCredits = Array.Empty<object>(),
            labels = Array.Empty<object>(),
            selectedArtistIds = Array.Empty<Guid>(),
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>(),
            externalSources = Array.Empty<object>(),
            tracks = new object[]
            {
                new
                {
                    id = introDraftTrackId,
                    trackMode = "releaseOnly",
                    position = 1,
                    disc = (string?)null,
                    side = (string?)null,
                    title = "Set intro",
                    durationSeconds = (int?)null,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    inheritReleaseArtistCredits = false,
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)null,
                    isSkipped = false
                },
                new
                {
                    id = linkedDraftTrackId,
                    trackMode = "link",
                    position = 2,
                    disc = (string?)null,
                    side = (string?)null,
                    title = "Known Theme",
                    durationSeconds = (int?)null,
                    artistNames = Array.Empty<string>(),
                    artistCredits = Array.Empty<object>(),
                    inheritReleaseArtistCredits = false,
                    selectedArtistIds = Array.Empty<Guid>(),
                    selectedTrackId = (Guid?)linkedTrackId,
                    isSkipped = false
                }
            }
        };
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        string content = await response.Content.ReadAsStringAsync();
        try
        {
            return JsonDocument.Parse(content);
        }
        catch (JsonException exception)
        {
            throw new InvalidOperationException($"Response was not JSON. Status: {response.StatusCode}. Body: {content}", exception);
        }
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
            return new TempImportRoot(Directory.CreateTempSubdirectory("discweave-import-track-controls-test-").FullName);
        }

        public void Dispose()
        {
            if (Directory.Exists(Path))
            {
                Directory.Delete(Path, recursive: true);
            }
        }
    }
}
