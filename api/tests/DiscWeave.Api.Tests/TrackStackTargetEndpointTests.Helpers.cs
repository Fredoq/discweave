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

    private static string TargetUrl(
        Guid? sourceTrackId,
        string? search,
        int? offset = null,
        int? limit = null)
    {
        List<string> query = [];
        if (sourceTrackId is { } sourceId)
        {
            query.Add($"sourceTrackId={sourceId:D}");
        }
        if (search is not null)
        {
            query.Add($"search={Uri.EscapeDataString(search)}");
        }
        if (offset is { } actualOffset)
        {
            query.Add($"offset={actualOffset}");
        }
        if (limit is { } actualLimit)
        {
            query.Add($"limit={actualLimit}");
        }
        return $"/api/tracks/stack-targets?{string.Join("&", query)}";
    }

    private static async Task<(HttpStatusCode Status, JsonElement Body)> GetJsonAsync(
        HttpClient client,
        string uri)
    {
        using HttpResponseMessage response = await client.GetAsync(uri);
        using JsonDocument document = await JsonDocument.ParseAsync(
            await response.Content.ReadAsStreamAsync());
        return (response.StatusCode, document.RootElement.Clone());
    }

    private static Guid[] RootIds(JsonDocument document) =>
    [
        .. document.RootElement.GetProperty("items")
            .EnumerateArray()
            .Select(item => item.GetProperty("rootTrackId").GetGuid())
    ];

    private static void AssertError(
        (HttpStatusCode Status, JsonElement Body) response,
        HttpStatusCode expectedStatus,
        string expectedCode)
    {
        Assert.Equal(expectedStatus, response.Status);
        Assert.Equal(expectedCode, response.Body.GetProperty("code").GetString());
    }

    private static async Task<(Guid RootId, Guid MemberId)> CreateStackAsync(
        HttpClient client,
        string rootTitle,
        string memberTitle,
        string? rootArtist = null,
        string? memberArtist = null)
    {
        Guid rootId = await CreateTrackAsync(client, rootTitle);
        Guid memberId = await CreateTrackAsync(client, memberTitle);
        await MarkOriginalAsync(client, rootId, rootTitle, 2000);
        if (rootArtist is not null)
        {
            await AddMainArtistAsync(client, rootId, rootArtist);
        }
        if (memberArtist is not null)
        {
            await AddMainArtistAsync(client, memberId, memberArtist);
        }
        await CreateRelationAsync(client, memberId, rootId, "versionOf");
        return (rootId, memberId);
    }

    private static async Task<(HttpClient Owner, HttpClient Other)>
        CreateAuthenticatedClientsAsync(ApiTestHost host)
    {
        HttpClient owner = host.CreateClient();
        using HttpResponseMessage registerResponse = await owner.PostAsJsonAsync(
            "/api/auth/register",
            new { email = "owner@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);
        using HttpResponseMessage createUserResponse = await owner.PostAsJsonAsync(
            "/api/admin/users",
            new
            {
                email = "collector@example.com",
                password = "Password1!",
                isAdmin = false
            });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);
        HttpClient other = host.CreateClient();
        using HttpResponseMessage loginResponse = await other.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "collector@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        return (owner, other);
    }
}
