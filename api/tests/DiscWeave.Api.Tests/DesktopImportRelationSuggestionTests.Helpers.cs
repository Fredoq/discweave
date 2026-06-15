using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    private static object AudioFile(string rootPath, string filePath, string title, int trackNumber)
    {
        return new
        {
            filePath,
            relativePath = Path.GetRelativePath(rootPath, filePath),
            format = "flac",
            sizeBytes = 4,
            lastModifiedAt = DateTimeOffset.UtcNow,
            contentHash = (string?)null,
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

    private static JsonElement FindTrackByTitle(JsonElement session, string title)
    {
        return session.GetProperty("drafts")
            .EnumerateArray()
            .SelectMany(draft => draft.GetProperty("tracks").EnumerateArray())
            .Single(track => track.GetProperty("title").GetString() == title);
    }

    private static async Task CreateDictionaryEntryAsync(HttpClient client, string code, string name)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/settings/dictionaries",
            new { kind = "trackRelationType", code, name });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private static async Task CreateParserRuleAsync(HttpClient client, string relationTypeCode, string alias, string direction)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/settings/track-relation-parser-rules",
            new
            {
                relationTypeCode,
                alias,
                matchMode = "exactLastParentheticalToken",
                confidence = 90,
                direction,
                sortOrder = 5,
                isActive = true
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
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
            return new TempImportRoot(Directory.CreateTempSubdirectory("discweave-import-relation-suggestion-test-").FullName);
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
