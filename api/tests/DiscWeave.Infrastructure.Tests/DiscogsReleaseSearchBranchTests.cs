using System.Net;
using System.Text.Json;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed class DiscogsReleaseSearchBranchTests
{
    private static readonly string[] CatalogThenDescriptiveIds = ["1001", "1002"];

    [Fact(DisplayName = "Release search adds catalog number matches to descriptive matches")]
    public async Task Release_search_adds_catalog_number_matches_to_descriptive_matches()
    {
        RecordingHttpMessageHandler handler = BranchHandler(catalogIds: [1001], descriptiveIds: [1001, 1002]);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(
                    Artist: "Depeche Mode",
                    Title: "Stripped",
                    CatalogNumber: "BONG 10",
                    TrackCount: 2),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(CatalogThenDescriptiveIds, result.Value.Items.Select(candidate => candidate.Source.ExternalId));
        Assert.Equal(2, result.Value.Total);
        Assert.Equal(1, handler.Requests.Count(request => request.RequestUri?.AbsolutePath == "/releases/1001"));
    }

    [Fact(DisplayName = "Release search keeps catalog number matches when descriptive fields find nothing")]
    public async Task Release_search_keeps_catalog_number_matches_when_descriptive_fields_find_nothing()
    {
        RecordingHttpMessageHandler handler = BranchHandler(catalogIds: [1001], descriptiveIds: []);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(
                    Artist: "Depeche Mode & Friends",
                    Title: "Stripped",
                    Year: 2014,
                    CatalogNumber: "BONG 10",
                    TrackCount: 3),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        ExternalMetadataReleaseCandidate candidate = Assert.Single(result.Value.Items);
        Assert.Equal("1001", candidate.Source.ExternalId);
    }

    [Fact(DisplayName = "Release search with only a catalog number sends one identifier search")]
    public async Task Release_search_with_only_a_catalog_number_sends_one_identifier_search()
    {
        RecordingHttpMessageHandler handler = BranchHandler(catalogIds: [1001], descriptiveIds: [1002]);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(CatalogNumber: "BONG 10"),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        HttpRequestMessage search = Assert.Single(handler.Requests, IsSearchRequest);
        Assert.Contains("catno=BONG%2010", search.RequestUri?.Query);
        Assert.Equal("1001", Assert.Single(result.Value.Items).Source.ExternalId);
    }

    private static bool IsSearchRequest(HttpRequestMessage request)
    {
        return request.RequestUri?.AbsolutePath == "/database/search";
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

    private static RecordingHttpMessageHandler BranchHandler(long[] catalogIds, long[] descriptiveIds)
    {
        return new RecordingHttpMessageHandler(request =>
        {
            string path = request.RequestUri?.AbsolutePath ?? string.Empty;
            if (path == "/database/search")
            {
                bool isCatalogSearch = request.RequestUri?.Query.Contains("catno=", StringComparison.Ordinal) == true;
                return SearchResponse(isCatalogSearch ? catalogIds : descriptiveIds);
            }

            return path switch
            {
                "/releases/1001" => ReleaseDetail(1001, trackCount: 1),
                "/releases/1002" => ReleaseDetail(1002, trackCount: 2),
                _ => new HttpResponseMessage(HttpStatusCode.NotFound)
            };
        });
    }

    private static HttpResponseMessage SearchResponse(long[] ids)
    {
        var body = new
        {
            pagination = new { items = ids.Length },
            results = ids.Select(id => new
            {
                type = "release",
                id,
                title = "Depeche Mode - Stripped",
                year = 1986,
                uri = $"/release/{id}-Depeche-Mode-Stripped"
            })
        };

        return JsonResponse(JsonSerializer.Serialize(body));
    }

    private static HttpResponseMessage ReleaseDetail(long id, int trackCount)
    {
        var body = new
        {
            id,
            title = "Depeche Mode - Stripped",
            uri = $"/release/{id}-Depeche-Mode-Stripped",
            tracklist = Enumerable.Range(1, trackCount).Select(index => new
            {
                type_ = "track",
                title = $"Track {index}",
                position = index.ToString(System.Globalization.CultureInfo.InvariantCulture)
            })
        };

        return JsonResponse(JsonSerializer.Serialize(body));
    }

    private static HttpResponseMessage JsonResponse(string content)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(content)
        };
    }
}
