using System.Net;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Theory(DisplayName = "Discogs original discovery options reject out of range values")]
    [InlineData(0, 3, 12, 25, 30)]
    [InlineData(11, 3, 12, 25, 30)]
    [InlineData(5, 0, 12, 25, 30)]
    [InlineData(5, 11, 12, 25, 30)]
    [InlineData(5, 3, 0, 25, 30)]
    [InlineData(5, 3, 51, 25, 30)]
    [InlineData(5, 3, 12, 0, 30)]
    [InlineData(5, 3, 12, 101, 30)]
    [InlineData(5, 3, 12, 25, 4)]
    [InlineData(5, 3, 12, 25, 61)]
    public void Discogs_original_discovery_options_reject_out_of_range_values(
        int maxRouteLookups,
        int maxSearchResults,
        int maxRequestsPerRoute,
        int maxRequestsPerDiscovery,
        int timeoutSeconds)
    {
        var options = new DiscogsOptions
        {
            UserAgent = "DiscWeave.Tests/1.0",
            BaseUrl = "https://api.discogs.test",
            TimeoutSeconds = 10,
            MaxOriginalRouteLookups = maxRouteLookups,
            MaxOriginalSearchResultsPerRoute = maxSearchResults,
            MaxOriginalRequestsPerRoute = maxRequestsPerRoute,
            MaxOriginalRequestsPerDiscovery = maxRequestsPerDiscovery,
            OriginalDiscoveryTimeoutSeconds = timeoutSeconds
        };

        Assert.False(DiscogsOptionsValidator.IsValid(options));
    }

    [Fact(DisplayName = "Original discovery budgets include every Discogs retry attempt")]
    public async Task Original_discovery_budgets_include_every_Discogs_retry_attempt()
    {
        RecordingHttpMessageHandler handler = new(_ =>
            new HttpResponseMessage(HttpStatusCode.ServiceUnavailable));
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);
        var discovery =
            DiscogsOriginalDiscoveryRequestBudget.Create(1);
        DiscogsOriginalRouteRequestBudget route =
            discovery.CreateRouteBudget(1);

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
            await provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("249504"),
                route,
                CancellationToken.None);

        Assert.False(result.IsSuccess);
        _ = Assert.Single(handler.Requests);
        Assert.Equal(1, discovery.UsedRequestCount);
        Assert.Equal(1, route.UsedRequestCount);
    }
}
