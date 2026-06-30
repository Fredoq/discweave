using System.Net;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed class DiscogsTrackMappingTests
{
    [Fact(DisplayName = "Release-backed track search fetches release detail and maps matching track rows")]
    public async Task Release_backed_track_search_fetches_release_detail_and_maps_matching_track_rows()
    {
        RecordingHttpMessageHandler handler = new(request =>
            request.RequestUri?.AbsolutePath == "/database/search"
                ? JsonResponse(
                    // lang=json
                    """
                    {
                      "pagination": { "items": 1 },
                      "results": [
                        {
                          "type": "release",
                          "id": 249504,
                          "title": "New Order - Blue Monday",
                          "year": 1983,
                          "uri": "/release/249504-New-Order-Blue-Monday"
                        }
                      ]
                    }
                    """)
                : JsonResponse(ReleaseDetailJson()));
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>> result =
            await provider.SearchTracksAsync(new ExternalMetadataTrackSearchQuery(Title: "Blue Monday", Artist: "New Order"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, handler.Requests.Count);
        Assert.Equal("/releases/249504", handler.Requests[1].RequestUri?.AbsolutePath);
        ExternalMetadataTrackCandidate candidate = Assert.Single(result.Value.Items);
        Assert.Equal("track", candidate.Source.ResourceType);
        Assert.StartsWith("249504:", candidate.Source.ExternalId, StringComparison.Ordinal);
        Assert.Equal("https://www.discogs.com/release/249504-New-Order-Blue-Monday", candidate.Source.SourceUrl);
        Assert.Equal("Blue Monday", candidate.Title);
        Assert.Equal("A", candidate.Position);
        Assert.Equal(TimeSpan.FromSeconds(449), candidate.Duration);
        Assert.Contains("New Order", candidate.Artists);
        Assert.Equal("Blue Monday", candidate.Release.Title);
    }

    [Fact(DisplayName = "Release-backed track search applies release track count filter before mapping tracks")]
    public async Task Release_backed_track_search_applies_release_track_count_filter_before_mapping_tracks()
    {
        RecordingHttpMessageHandler handler = new(request =>
            request.RequestUri?.AbsolutePath == "/database/search"
                ? JsonResponse(
                    // lang=json
                    """
                    {
                      "pagination": { "items": 1 },
                      "results": [
                        {
                          "type": "release",
                          "id": 249504,
                          "title": "New Order - Blue Monday",
                          "year": 1983,
                          "uri": "/release/249504-New-Order-Blue-Monday"
                        }
                      ]
                    }
                    """)
                : JsonResponse(ReleaseDetailJson()));
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>> result =
            await provider.SearchTracksAsync(new ExternalMetadataTrackSearchQuery(Title: "Blue Monday", TrackCount: 1), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Items);
        Assert.Equal(0, result.Value.Total);
    }

    [Fact(DisplayName = "Release-backed track search sends page and orders candidates by release year")]
    public async Task Release_backed_track_search_sends_page_and_orders_candidates_by_release_year()
    {
        RecordingHttpMessageHandler handler = new(request =>
            request.RequestUri?.AbsolutePath == "/database/search"
                ? JsonResponse(
                    // lang=json
                    """
                    {
                      "pagination": { "items": 2 },
                      "results": [
                        { "type": "release", "id": 1990, "title": "Artist - Later", "year": 1990, "uri": "/release/1990-Later" },
                        { "type": "release", "id": 1988, "title": "Artist - Earlier", "year": 1988, "uri": "/release/1988-Earlier" }
                      ]
                    }
                    """)
                : JsonResponse(request.RequestUri?.AbsolutePath == "/releases/1990"
                    ? ReleaseDetailJson(1990, "Later", 1990)
                    : ReleaseDetailJson(1988, "Earlier", 1988)));
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>> result =
            await provider.SearchTracksAsync(
                new ExternalMetadataTrackSearchQuery(
                    Title: "Show Me Love",
                    Limit: 25,
                    Page: 2,
                    Sort: ExternalMetadataTrackSearchSort.ReleaseYearAscending),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Uri? searchUri = handler.Requests[0].RequestUri;
        Assert.Equal("2", QueryValue(searchUri, "page"));
        Assert.Equal("year", QueryValue(searchUri, "sort"));
        Assert.Equal("asc", QueryValue(searchUri, "sort_order"));
        Assert.Collection(
            result.Value.Items,
            candidate => Assert.Equal(1988, candidate.Release.Year),
            candidate => Assert.Equal(1990, candidate.Release.Year));
        Assert.Equal(2, result.Value.Total);
    }

    [Fact(DisplayName = "Selected release-backed track detail maps credits and release context")]
    public async Task Selected_release_backed_track_detail_maps_credits_and_release_context()
    {
        RecordingHttpMessageHandler searchHandler = new(request =>
            request.RequestUri?.AbsolutePath == "/database/search"
                ? JsonResponse(
                    // lang=json
                    """
                    {
                      "pagination": { "items": 1 },
                      "results": [ { "type": "release", "id": 249504, "title": "New Order - Blue Monday" } ]
                    }
                    """)
                : JsonResponse(ReleaseDetailJson()));
        DiscogsExternalMetadataProvider searchProvider = CreateProvider(searchHandler);
        ExternalMetadataTrackCandidate candidate = Assert.Single((
            await searchProvider.SearchTracksAsync(new ExternalMetadataTrackSearchQuery(Title: "Blue Monday"), CancellationToken.None)).Value.Items);
        RecordingHttpMessageHandler detailHandler = new(_ => JsonResponse(ReleaseDetailJson()));
        DiscogsExternalMetadataProvider detailProvider = CreateProvider(detailHandler);

        ExternalMetadataResult<ExternalMetadataTrackDetail> result =
            await detailProvider.GetTrackAsync(new ExternalMetadataLookupQuery(candidate.Source.ExternalId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("/releases/249504", Assert.Single(detailHandler.Requests).RequestUri?.AbsolutePath);
        Assert.Equal("Blue Monday", result.Value.Title);
        Assert.Equal("A", result.Value.Position);
        Assert.Equal(TimeSpan.FromSeconds(449), result.Value.Duration);
        Assert.Contains(result.Value.Credits, credit => credit.Name == "Remixer Name" && credit.Role == "Remix");
        Assert.Equal("Blue Monday", result.Value.Release.Title);
    }

    private static string ReleaseDetailJson()
    {
        return
            // lang=json
            """
            {
              "id": 249504,
              "title": "Blue Monday",
              "year": 1983,
              "uri": "/release/249504-New-Order-Blue-Monday",
              "artists": [ { "name": "New Order" } ],
              "labels": [ { "name": "Factory", "catno": "FAC 73" } ],
              "formats": [ { "name": "Vinyl" } ],
              "tracklist": [
                {
                  "type_": "heading",
                  "position": "",
                  "title": "Blue Monday Disc",
                  "extraartists": [ { "name": "Heading Credit", "role": "Design" } ]
                },
                {
                  "type_": "track",
                  "position": "A",
                  "title": "Blue Monday",
                  "duration": "7:29",
                  "artists": [ { "name": "New Order" } ],
                  "extraartists": [ { "name": "Remixer Name", "role": "Remix" } ]
                },
                { "type_": "track", "position": "B", "title": "The Beach", "duration": "7:19" }
              ]
            }
            """;
    }

    private static string ReleaseDetailJson(long id, string releaseTitle, int year)
    {
        return $$"""
            {
              "id": {{id}},
              "title": "{{releaseTitle}}",
              "year": {{year}},
              "uri": "/release/{{id}}-{{releaseTitle}}",
              "artists": [ { "name": "Robin S." } ],
              "tracklist": [
                {
                  "type_": "track",
                  "position": "A",
                  "title": "Show Me Love",
                  "duration": "4:26",
                  "artists": [ { "name": "Robin S." } ]
                }
              ]
            }
            """;
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

    private static HttpResponseMessage JsonResponse(string content)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(content)
        };
    }

    private static string? QueryValue(Uri? uri, string name)
    {
        string query = uri?.Query.TrimStart('?') ?? string.Empty;
        return query.Split('&', StringSplitOptions.RemoveEmptyEntries)
            .Select(part => part.Split('=', 2))
            .Where(parts => parts.Length == 2)
            .Select(parts => new KeyValuePair<string, string>(
                Uri.UnescapeDataString(parts[0]),
                Uri.UnescapeDataString(parts[1])))
            .FirstOrDefault(pair => pair.Key == name)
            .Value;
    }
}
