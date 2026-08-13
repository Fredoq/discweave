using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.ExternalMetadata;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    private async Task<ApiTestHost> CreateHostWithProviderAsync(
        FakeRecordingLineageProvider provider)
    {
        return await ApiTestHost.CreateAsync(
            _sqlite,
            services =>
            {
                _ = services.RemoveAll<IExternalMetadataProvider>();
                _ = services.AddSingleton<IExternalMetadataProvider>(provider);
            });
    }

    private static async Task<Guid> CreateCatalogTrackAsync(
        HttpClient client,
        string title)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/tracks",
            new
            {
                title,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>()
            });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using JsonDocument document = await ReadJsonAsync(response);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task MarkCatalogTrackOriginalAsync(
        HttpClient client,
        Guid trackId,
        string title)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            $"/api/tracks/{trackId:D}",
            new
            {
                title,
                isOriginal = true,
                genres = Array.Empty<string>(),
                tags = Array.Empty<string>(),
                credits = Array.Empty<object>(),
                releaseAppearances = Array.Empty<object>()
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<string> TrackPayloadAsync(
        HttpClient client,
        Guid trackId)
    {
        using HttpResponseMessage response = await client.GetAsync(
            $"/api/tracks/{trackId:D}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsStringAsync();
    }

    private static async Task<int> RelationCountAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync(
            "/api/track-relations");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using JsonDocument document = await ReadJsonAsync(response);
        return document.RootElement.GetProperty("total").GetInt32();
    }

    private static async Task<JsonDocument> ReadJsonAsync(
        HttpResponseMessage response)
    {
        return JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());
    }
}
