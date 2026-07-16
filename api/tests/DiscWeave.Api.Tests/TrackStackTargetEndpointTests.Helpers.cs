using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackStackTargetEndpointTests : IClassFixture<SqliteFixture>
{
    private static readonly string[] _mainArtistRoles = ["mainArtist"];
    private readonly SqliteFixture _sqlite;

    public TrackStackTargetEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    private static JsonElement.ArrayEnumerator Items(JsonDocument document)
    {
        return document.RootElement.GetProperty("items").EnumerateArray();
    }

    private static async Task<JsonDocument> GetTargetsAsync(
        HttpClient client,
        Guid sourceTrackId,
        string search,
        int? offset = null,
        int? limit = null)
    {
        string query = $"sourceTrackId={sourceTrackId:D}&search={Uri.EscapeDataString(search)}";
        query += offset.HasValue ? $"&offset={offset.Value}" : string.Empty;
        query += limit.HasValue ? $"&limit={limit.Value}" : string.Empty;
        using HttpResponseMessage response = await client.GetAsync($"/api/tracks/stack-targets?{query}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }

    private static async Task<Guid> CreateTrackAsync(HttpClient client, string title)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new { title, genres = Array.Empty<string>(), tags = Array.Empty<string>() });
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task MarkOriginalAsync(
        HttpClient client,
        Guid trackId,
        string title,
        int? versionYear)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/tracks/{trackId:D}",
            new
            {
                title,
                versionYear,
                isOriginal = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                credits = Array.Empty<object>(),
                releaseAppearances = Array.Empty<object>()
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task AddMainArtistAsync(
        HttpClient client,
        Guid trackId,
        string artistName)
    {
        using HttpResponseMessage artistResponse = await client.PostAsJsonAsync(
            "/api/artists",
            new { type = "person", name = artistName });
        using var artistDocument = JsonDocument.Parse(
            await artistResponse.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Created, artistResponse.StatusCode);
        Guid artistId = artistDocument.RootElement.GetProperty("id").GetGuid();
        using HttpResponseMessage creditResponse = await client.PostAsJsonAsync(
            "/api/credits",
            new
            {
                contributorArtistId = artistId,
                targetType = "track",
                targetId = trackId,
                roles = _mainArtistRoles
            });
        Assert.Equal(HttpStatusCode.Created, creditResponse.StatusCode);
    }

    private static async Task CreateRelationAsync(
        HttpClient client,
        Guid sourceTrackId,
        Guid targetTrackId,
        string type)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations",
            new { sourceTrackId, targetTrackId, type });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }
}
