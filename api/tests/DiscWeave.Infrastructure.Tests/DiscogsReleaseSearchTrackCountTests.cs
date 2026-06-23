using System.Net;
using System.Text.Json;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed class DiscogsReleaseSearchTrackCountTests
{
    [Fact(DisplayName = "Release search track count filters enriched Discogs candidates")]
    public async Task Release_search_track_count_filters_enriched_Discogs_candidates()
    {
        RecordingHttpMessageHandler handler = ReleaseSearchWithTwoDetailsHandler();
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(
                    Title: "Stripped",
                    TrackCount: 2),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, handler.Requests.Count);
        ExternalMetadataReleaseCandidate candidate = Assert.Single(result.Value.Items);
        Assert.Equal("1002", candidate.Source.ExternalId);
        Assert.Equal(2, candidate.TrackCount);
        Assert.Equal(1, result.Value.Total);
    }

    private static DiscogsExternalMetadataProvider CreateProvider(RecordingHttpMessageHandler handler)
    {
        HttpClient httpClient = new(handler)
        {
            BaseAddress = new Uri("https://api.discogs.test")
        };

        return new DiscogsExternalMetadataProvider(
            httpClient,
            Options.Create(new DiscogsOptions
            {
                UserAgent = "DiscWeave.Tests/1.0",
                BaseUrl = "https://api.discogs.test",
                TimeoutSeconds = 10
            }),
            new FixedDiscogsAccessTokenProvider("test-token"));
    }

    private static RecordingHttpMessageHandler ReleaseSearchWithTwoDetailsHandler()
    {
        return new RecordingHttpMessageHandler(request =>
            request.RequestUri?.AbsolutePath switch
            {
                "/database/search" => JsonResponse(
                    // lang=json
                    """
                    {
                      "pagination": { "items": 2 },
                      "results": [
                        {
                          "type": "release",
                          "id": 1001,
                          "title": "Depeche Mode - Stripped",
                          "year": 1986,
                          "uri": "/release/1001-Depeche-Mode-Stripped"
                        },
                        {
                          "type": "release",
                          "id": 1002,
                          "title": "Depeche Mode - Stripped",
                          "year": 1986,
                          "uri": "/release/1002-Depeche-Mode-Stripped"
                        }
                      ]
                    }
                    """),
                "/releases/1001" => ReleaseDetail(
                    1001,
                    JsonSerializer.Serialize(
                        new[]
                        {
                            new { type_ = "track", title = "Stripped", position = "A" }
                        })),
                "/releases/1002" => ReleaseDetail(
                    1002,
                    JsonSerializer.Serialize(
                        new[]
                        {
                            new { type_ = "track", title = "Stripped", position = "A" },
                            new { type_ = "track", title = "But Not Tonight", position = "B" }
                        })),
                _ => new HttpResponseMessage(HttpStatusCode.NotFound)
            });
    }

    private static HttpResponseMessage ReleaseDetail(long id, string tracklistJson)
    {
        return JsonResponse(
            $$"""
            {
              "id": {{id}},
              "title": "Depeche Mode - Stripped",
              "uri": "/release/{{id}}-Depeche-Mode-Stripped",
              "tracklist": {{tracklistJson}}
            }
            """);
    }

    private static HttpResponseMessage JsonResponse(string content)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(content)
        };
    }
}
