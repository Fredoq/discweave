using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportEndpointTests
{
    private static async Task<JsonDocument> AttachLooseFileAsync(
        HttpClient client,
        Guid sessionId,
        Guid releaseId,
        Guid candidateId,
        Guid releaseTrackId,
        bool confirmRelink)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/imports/{sessionId}/loose-file-attachments",
            new
            {
                releaseId,
                mappings = new[]
                {
                    new { candidateId, releaseTrackId, confirmRelink }
                }
            });
        JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        return document;
    }

    private static async Task<Guid> CreateAttachArtistAsync(HttpClient client, string name)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/artists", new { type = "person", name });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> CreateAttachReleaseAsync(
        HttpClient client,
        string title,
        Guid artistId,
        object[] tracklist)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/releases",
            new
            {
                title,
                type = "single",
                isVariousArtists = false,
                artistCredits = new object[] { new { artistId, role = "mainArtist" } },
                labels = Array.Empty<object>(),
                notOnLabel = true,
                year = 2026,
                genres = AttachElectronicGenres,
                tags = Array.Empty<string>(),
                tracklist,
                ownedCopy = (object?)null
            });
        JsonDocument document = await ReadJsonAsync(response);
        Assert.True(response.StatusCode == HttpStatusCode.Created, document.RootElement.ToString());

        return document;
    }

    private static async Task<Guid> CreateAttachDigitalOwnedItemAsync(HttpClient client, Guid releaseId)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/owned-items",
            new
            {
                releaseId,
                status = "owned",
                medium = new { type = "digital" },
                condition = (string?)null,
                storageLocation = (string?)null
            });
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        return document.RootElement.GetProperty("id").GetGuid();
    }
}
