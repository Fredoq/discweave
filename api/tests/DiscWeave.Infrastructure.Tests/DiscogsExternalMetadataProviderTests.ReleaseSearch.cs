using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Fact(DisplayName = "Release search sends Discogs query parameters and maps candidate summaries")]
    public async Task Release_search_sends_Discogs_query_parameters_and_maps_candidate_summaries()
    {
        RecordingHttpMessageHandler handler = ReleaseSearchWithDetailHandler();
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(
                new ExternalMetadataReleaseSearchQuery(
                    Artist: "New Order",
                    Title: "Blue Monday",
                    Year: 1983,
                    Barcode: "5016839200371",
                    CatalogNumber: "FAC 73"),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, handler.Requests.Count);
        HttpRequestMessage identifierRequest = handler.Requests[0];
        Assert.Equal(HttpMethod.Get, identifierRequest.Method);
        Assert.Equal("/database/search", identifierRequest.RequestUri?.AbsolutePath);
        Assert.Contains("type=release", identifierRequest.RequestUri?.Query);
        Assert.Contains("barcode=5016839200371", identifierRequest.RequestUri?.Query);
        Assert.Contains("catno=FAC%2073", identifierRequest.RequestUri?.Query);
        Assert.DoesNotContain("artist=", identifierRequest.RequestUri?.Query);
        Assert.Equal("DiscWeave.Tests/1.0", identifierRequest.Headers.UserAgent.ToString());
        Assert.Equal("Discogs token=test-token", identifierRequest.Headers.Authorization?.ToString());
        HttpRequestMessage descriptiveRequest = handler.Requests[1];
        Assert.Equal("/database/search", descriptiveRequest.RequestUri?.AbsolutePath);
        Assert.Contains("artist=New%20Order", descriptiveRequest.RequestUri?.Query);
        Assert.Contains("release_title=Blue%20Monday", descriptiveRequest.RequestUri?.Query);
        Assert.Contains("year=1983", descriptiveRequest.RequestUri?.Query);
        Assert.DoesNotContain("catno=", descriptiveRequest.RequestUri?.Query);
        Assert.Equal("/releases/249504", handler.Requests[2].RequestUri?.AbsolutePath);

        ExternalMetadataReleaseCandidate candidate = Assert.Single(result.Value.Items);
        Assert.Equal("discogs", candidate.Source.ProviderName);
        Assert.Equal("release", candidate.Source.ResourceType);
        Assert.Equal("249504", candidate.Source.ExternalId);
        Assert.Equal("https://www.discogs.com/release/249504-New-Order-Blue-Monday", candidate.Source.SourceUrl);
        Assert.Equal("Data provided by Discogs.", candidate.Source.Attribution);
        Assert.Equal("New Order - Blue Monday", candidate.Title);
        Assert.Equal(1983, candidate.Year);
        Assert.Contains("Factory", candidate.Labels);
        Assert.Contains("Vinyl", candidate.Formats);
        Assert.Contains("5016839200371", candidate.Barcodes);
        Assert.Equal(1, candidate.TrackCount);
    }
}
