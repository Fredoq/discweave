using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    private static readonly string[] _identityMainArtistRoles = ["mainArtist"];

    [Fact(DisplayName = "Relation suggestions identify catalog targets without exposing another collection")]
    public async Task Relation_suggestions_identify_catalog_targets_without_exposing_another_collection()
    {
        using var root = TempImportRoot.Create();
        string directory = Path.Combine(root.Path, "[DW 27, 1998] Run-DMC - Relation Test");
        _ = Directory.CreateDirectory(directory);
        string file = Path.Combine(directory, "01 Radio Edit.flac");
        await File.WriteAllTextAsync(file, "flac");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient client, HttpClient other) = await CreateAuthenticatedClientsAsync(host);
        Guid foreignId = await CreateTrackAsync(other, "It's Like That");
        using HttpResponseMessage trackResponse = await client.PostAsJsonAsync(
            "/api/tracks", new { title = "It's Like That", versionYear = 1983 });
        Assert.Equal(HttpStatusCode.Created, trackResponse.StatusCode);
        using JsonDocument trackDocument = await ReadJsonAsync(trackResponse);
        Guid trackId = trackDocument.RootElement.GetProperty("id").GetGuid();
        using HttpResponseMessage artistResponse = await client.PostAsJsonAsync(
            "/api/artists", new { type = "group", name = "Run-DMC" });
        Assert.Equal(HttpStatusCode.Created, artistResponse.StatusCode);
        using JsonDocument artistDocument = await ReadJsonAsync(artistResponse);
        using HttpResponseMessage creditResponse = await client.PostAsJsonAsync(
            "/api/credits", new
            {
                contributorArtistId = artistDocument.RootElement.GetProperty("id").GetGuid(),
                targetType = "track",
                targetId = trackId,
                roles = _identityMainArtistRoles
            });
        Assert.Equal(HttpStatusCode.Created, creditResponse.StatusCode);

        using HttpResponseMessage scanResponse = await client.PostAsJsonAsync(
            "/api/imports/desktop-folder-scans", new
            {
                sourceRoot = root.Path,
                ignoredFileCount = 0,
                diagnostics = Array.Empty<object>(),
                files = new[] { AudioFile(root.Path, file, "It's Like That (Radio Edit)", 1) }
            });
        Assert.Equal(HttpStatusCode.Created, scanResponse.StatusCode);
        using JsonDocument scan = await ReadJsonAsync(scanResponse);
        Guid sessionId = scan.RootElement.GetProperty("id").GetGuid();
        using HttpResponseMessage detailResponse = await client.GetAsync($"/api/imports/{sessionId}");
        Assert.Equal(HttpStatusCode.OK, detailResponse.StatusCode);
        using JsonDocument detail = await ReadJsonAsync(detailResponse);

        foreach (JsonElement session in new[] { scan.RootElement, detail.RootElement })
        {
            JsonElement suggestion = Assert.Single(session.GetProperty("relationSuggestions").EnumerateArray());
            JsonElement option = Assert.Single(suggestion.GetProperty("targetOptions").EnumerateArray());
            foreach (JsonElement endpoint in new[]
            {
                option,
                suggestion.GetProperty("suggested").GetProperty("target"),
                suggestion.GetProperty("reviewed").GetProperty("target")
            })
            {
                Assert.Equal(trackId, endpoint.GetProperty("id").GetGuid());
                Assert.NotEqual(foreignId, endpoint.GetProperty("id").GetGuid());
                Assert.Equal("It's Like That", endpoint.GetProperty("title").GetString());
                Assert.Equal("Run-DMC", endpoint.GetProperty("artistDisplay").GetString());
                Assert.Equal(1983, endpoint.GetProperty("versionYear").GetInt32());
            }

            Assert.Equal("It's Like That (Radio Edit)",
                suggestion.GetProperty("reviewed").GetProperty("source").GetProperty("title").GetString());
        }
    }
}
