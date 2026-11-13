using System.Diagnostics.CodeAnalysis;
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
                    CatalogNumber: "BONG 10"),
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
                    TrackCount: 1),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        ExternalMetadataReleaseCandidate candidate = Assert.Single(result.Value.Items);
        Assert.Equal("1001", candidate.Source.ExternalId);
    }

    [Fact(DisplayName = "Release search applies the track count to catalog number matches too")]
    public async Task Release_search_applies_the_track_count_to_catalog_number_matches_too()
    {
        RecordingHttpMessageHandler handler = BranchHandler(catalogIds: [1001], descriptiveIds: [1002]);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(
                    Title: "Stripped",
                    CatalogNumber: "BONG 10",
                    TrackCount: 2,
                    Limit: 1),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        ExternalMetadataReleaseCandidate candidate = Assert.Single(result.Value.Items);
        Assert.Equal("1002", candidate.Source.ExternalId);
        Assert.Equal(1, result.Value.Total);
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

    [Fact(DisplayName = "Release search limits merged candidates while keeping identifier matches first")]
    public async Task Release_search_limits_merged_candidates_while_keeping_identifier_matches_first()
    {
        RecordingHttpMessageHandler handler = BranchHandler(catalogIds: [1001], descriptiveIds: [1002]);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(Title: "Stripped", CatalogNumber: "BONG 10", Limit: 1),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("1001", Assert.Single(result.Value.Items).Source.ExternalId);
        Assert.Equal(2, result.Value.Total);
    }

    [Fact(DisplayName = "Release search bounds hydration even when the provider ignores the page size")]
    public async Task Release_search_bounds_hydration_even_when_the_provider_ignores_the_page_size()
    {
        RecordingHttpMessageHandler handler = BranchHandler(catalogIds: [], descriptiveIds: [1001, 1002]);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);
        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(new ExternalMetadataReleaseSearchQuery(Title: "Stripped", Limit: 1), CancellationToken.None);
        Assert.True(result.IsSuccess);
        _ = Assert.Single(result.Value.Items);
        Assert.Equal(2, handler.Requests.Count);
        Assert.DoesNotContain(handler.Requests, request => request.RequestUri?.AbsolutePath == "/releases/1002");
    }

    [Fact(DisplayName = "Release search preserves descriptive track count matches beyond the first hundred identifiers")]
    public async Task Release_search_preserves_descriptive_track_count_matches_beyond_the_first_hundred_identifiers()
    {
        long[] identifiers = [.. Enumerable.Range(1001, 100).Select(id => (long)id)];
        RecordingHttpMessageHandler handler = BranchHandler(identifiers, [2001], matchingIds: [2001]);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(Title: "Stripped", CatalogNumber: "BONG 10", TrackCount: 2, Limit: 100),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("2001", Assert.Single(result.Value.Items).Source.ExternalId);
        Assert.Equal(1, result.Value.Total);
        Assert.Equal(103, handler.Requests.Count);
    }

    [Fact(DisplayName = "Release search deduplicates before filtering and limits after preserving identifier order")]
    public async Task Release_search_deduplicates_before_filtering_and_limits_after_preserving_identifier_order()
    {
        RecordingHttpMessageHandler handler = BranchHandler([1002, 1001], [1002, 2001]);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(Title: "Stripped", CatalogNumber: "BONG 10", TrackCount: 2, Limit: 1),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("1002", Assert.Single(result.Value.Items).Source.ExternalId);
        Assert.Equal(2, result.Value.Total);
        Assert.Equal(1, handler.Requests.Count(request => request.RequestUri?.AbsolutePath == "/releases/1002"));
        Assert.Contains(handler.Requests, request => request.RequestUri?.AbsolutePath == "/releases/2001");
    }

    [Fact(DisplayName = "Release search bounds each oversized branch before hydrating track count candidates")]
    public async Task Release_search_bounds_each_oversized_branch_before_hydrating_track_count_candidates()
    {
        long[] identifiers = [.. Enumerable.Range(1001, 101).Select(id => (long)id)];
        long[] descriptions = [.. Enumerable.Range(2001, 101).Select(id => (long)id)];
        RecordingHttpMessageHandler handler = BranchHandler(identifiers, descriptions, matchingIds: [2001]);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(Title: "Stripped", CatalogNumber: "BONG 10", TrackCount: 2, Limit: 100),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("2001", Assert.Single(result.Value.Items).Source.ExternalId);
        Assert.Equal(1, result.Value.Total);
        Assert.Equal(202, handler.Requests.Count);
        Assert.DoesNotContain(handler.Requests, request => request.RequestUri?.AbsolutePath is "/releases/1101" or "/releases/2101");
    }

    [Fact(DisplayName = "Discogs release detail maps a verified master provenance reference")]
    public async Task Discogs_release_detail_maps_a_verified_master_provenance_reference()
    {
        var handler = new RecordingHttpMessageHandler(_ => JsonResponse("""
            {"id":1001,"title":"Stripped","uri":"https://www.discogs.com/release/1001","master_id":90,"tracklist":[]}
            """));
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);
        ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
            await provider.GetReleaseAsync(new ExternalMetadataLookupQuery("1001"), CancellationToken.None);
        Assert.True(result.IsSuccess);
        ExternalMetadataSource master = Assert.Single(result.Value.RelatedSources);
        Assert.Equal("master", master.ResourceType);
        Assert.Equal("90", master.ExternalId);
        Assert.Equal("https://www.discogs.com/master/90", master.SourceUrl);
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

    private static RecordingHttpMessageHandler BranchHandler(long[] catalogIds, long[] descriptiveIds, long[]? matchingIds = null)
    {
        return new RecordingHttpMessageHandler(request =>
        {
            string path = request.RequestUri?.AbsolutePath ?? string.Empty;
            if (path == "/database/search")
            {
                bool isCatalogSearch = request.RequestUri?.Query.Contains("catno=", StringComparison.Ordinal) == true;
                return SearchResponse(isCatalogSearch ? catalogIds : descriptiveIds);
            }

            long id = long.Parse(path.Split('/')[^1], System.Globalization.CultureInfo.InvariantCulture);
            bool matches = (matchingIds ?? [1002, 2001]).Contains(id);
            return ReleaseDetail(id, trackCount: matches ? 2 : 1);
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

    private static HttpResponseMessage JsonResponse([StringSyntax(StringSyntaxAttribute.Json)] string content)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(content)
        };
    }
}
