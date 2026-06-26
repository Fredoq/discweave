using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    private static readonly string[] BeginsTrackArtistNames = ["Steve Bicknell", "C.K. & pH 1"];

    private static async Task<JsonDocument> PostScanAsync(HttpClient client, string rootPath, string audioPath)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans",
            new
            {
                sourceRoot = rootPath,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new[]
                {
                    new
                    {
                        filePath = audioPath,
                        relativePath = Path.GetRelativePath(rootPath, audioPath),
                        format = "flac",
                        sizeBytes = 9,
                        lastModifiedAt = DateTimeOffset.UtcNow,
                        audioMetadata = new
                        {
                            title = (string?)null,
                            artists = BeginsTrackArtistNames,
                            albumTitle = (string?)null,
                            albumArtists = Array.Empty<string>(),
                            catalogNumber = (string?)null,
                            releaseDate = (string?)null,
                            year = (int?)null,
                            durationSeconds = (int?)null,
                            trackNumber = (int?)null
                        },
                        coverArtifact = (object?)null
                    }
                }
            });
        JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document;
    }

    private static object EmptyDesktopScan()
    {
        return new
        {
            sourceRoot = "/tmp/discweave-empty",
            files = Array.Empty<object>(),
            ignoredFileCount = 0,
            diagnostics = Array.Empty<object>()
        };
    }

    private static object ConfirmedDraftUpdatePayload()
    {
        return new
        {
            title = "Edited after confirmation",
            type = "unknown",
            catalogNumber = (string?)null,
            labelName = (string?)null,
            releaseDate = (string?)null,
            year = (int?)null,
            isVariousArtists = false,
            notOnLabel = false,
            coverPath = (string?)null,
            artistNames = Array.Empty<string>(),
            artistCredits = Array.Empty<object>(),
            labels = Array.Empty<object>(),
            selectedArtistIds = Array.Empty<Guid>(),
            genres = Array.Empty<string>(),
            tags = Array.Empty<string>(),
            tracks = Array.Empty<object>()
        };
    }

    private static void AssertOldEndpointIsUnavailable(HttpResponseMessage response)
    {
        Assert.True(
            response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.MethodNotAllowed,
            $"Expected old endpoint to be unavailable, got {response.StatusCode}");
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
            throw new InvalidOperationException(
                $"Response was not JSON. Status: {response.StatusCode}. Body: {content}",
                exception);
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
            return new TempImportRoot(Directory.CreateTempSubdirectory("discweave-import-test-").FullName);
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
