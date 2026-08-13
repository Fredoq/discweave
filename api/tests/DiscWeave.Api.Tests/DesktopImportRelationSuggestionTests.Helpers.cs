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

    private static async Task DeactivateTrackRelationTypeAsync(HttpClient client, string code)
    {
        using HttpResponseMessage listResponse = await client.GetAsync("/api/settings/dictionaries?kind=trackRelationType");
        using JsonDocument listDocument = await ReadJsonAsync(listResponse);
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        JsonElement entry = listDocument.RootElement.GetProperty("items")
            .EnumerateArray()
            .Single(item => item.GetProperty("code").GetString() == code);

        using HttpResponseMessage updateResponse = await client.PutAsJsonAsync(
            $"/api/settings/dictionaries/{entry.GetProperty("id").GetGuid()}",
            new
            {
                name = entry.GetProperty("name").GetString(),
                sortOrder = entry.GetProperty("sortOrder").GetInt32(),
                isActive = false
            });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
    }

    private static async Task<JsonDocument> ReadJsonAsync(HttpResponseMessage response)
    {
        Stream stream = await response.Content.ReadAsStreamAsync();
        return await JsonDocument.ParseAsync(stream);
    }

    private static async Task<Guid> CreateTrackAsync(HttpClient client, string title)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title, genres = Array.Empty<string>(), tags = Array.Empty<string>() });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<(HttpClient Owner, HttpClient Other)> CreateAuthenticatedClientsAsync(ApiTestHost host)
    {
        HttpClient owner = host.CreateClient();
        using HttpResponseMessage registerResponse = await owner.PostAsJsonAsync(
            "/api/auth/register",
            new { email = "owner@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);
        using HttpResponseMessage createUserResponse = await owner.PostAsJsonAsync(
            "/api/admin/users",
            new { email = "collector@example.com", password = "Password1!", isAdmin = false });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);
        HttpClient other = host.CreateClient();
        using HttpResponseMessage loginResponse = await other.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "collector@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return (owner, other);
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
