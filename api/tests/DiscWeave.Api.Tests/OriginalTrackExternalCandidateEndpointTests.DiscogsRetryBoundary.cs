using System.Net;
using System.Net.Http.Json;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Theory(DisplayName = "Discogs retry local gates make zero resolver calls")]
    [InlineData(LocalOriginalCandidateStatus.SourceNotFound, false, HttpStatusCode.NotFound)]
    [InlineData(LocalOriginalCandidateStatus.SourceNotEligible, false, HttpStatusCode.Conflict)]
    [InlineData(LocalOriginalCandidateStatus.Success, true, HttpStatusCode.Conflict)]
    public async Task Discogs_retry_local_gates_make_zero_resolver_calls(
        LocalOriginalCandidateStatus status,
        bool reliable,
        HttpStatusCode expectedStatus)
    {
        LocalOriginalCandidateResult local = EmptyLocalResult() with
        {
            Status = status,
            Candidates = reliable
                ?
                [
                    Candidate(
                        Guid.Parse(
                            "99999999-9999-9999-9999-999999999999"),
                        OriginalCandidateConfidence.High)
                ]
                : []
        };
        var resolver = new CapturingRetryResolver();
        await using ApiTestHost host =
            await CreateRetryHostAsync(local, resolver);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external/discogs-routes/retry",
            RetryRequest());

        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.Null(resolver.LastContext);
    }

    [Fact(DisplayName = "Discogs retry rejects more than the configured item cap")]
    public async Task Discogs_retry_rejects_more_than_the_configured_item_cap()
    {
        LocalOriginalCandidateResult local = EmptyLocalResult();
        var resolver = new CapturingRetryResolver();
        await using ApiTestHost host =
            await CreateRetryHostAsync(local, resolver);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        DiscogsOriginalRouteRetryRequest request = RetryRequest();
        DiscogsOriginalRouteRetryRequest.ItemData item =
            Assert.Single(request.RetryContext.Items);
        request = request with
        {
            RetryContext = request.RetryContext with
            {
                Items = [item, item, item, item, item, item]
            }
        };

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external/discogs-routes/retry",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(resolver.LastContext);
    }

    [Theory(DisplayName = "Discogs retry rejects nested tampering")]
    [InlineData("non-discogs-related")]
    [InlineData("malformed-date")]
    [InlineData("malformed-row")]
    [InlineData("cross-release-snapshot")]
    public async Task Discogs_retry_rejects_nested_tampering(string vector)
    {
        LocalOriginalCandidateResult local = EmptyLocalResult();
        var resolver = new CapturingRetryResolver();
        await using ApiTestHost host =
            await CreateRetryHostAsync(local, resolver);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        DiscogsOriginalRouteRetryRequest request =
            TamperRetryRequest(RetryRequest(), vector);

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external/discogs-routes/retry",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(resolver.LastContext);
    }

    [Fact(DisplayName = "Valid Discogs retry performs no catalog writes")]
    public async Task Valid_Discogs_retry_performs_no_catalog_writes()
    {
        LocalOriginalCandidateResult local = EmptyLocalResult();
        var resolver = new CapturingRetryResolver();
        await using ApiTestHost host =
            await CreateRetryHostAsync(local, resolver);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        int relationsBefore = await RelationCountAsync(client);

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external/discogs-routes/retry",
            RetryRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            relationsBefore,
            await RelationCountAsync(client));
    }

    private static DiscogsOriginalRouteRetryRequest TamperRetryRequest(
        DiscogsOriginalRouteRetryRequest request,
        string vector)
    {
        DiscogsOriginalRouteRetryRequest.ItemData item =
            Assert.Single(request.RetryContext.Items);
        DiscogsOriginalRouteRetryRequest.ItemData tampered = vector switch
        {
            "non-discogs-related" => item with
            {
                Route = item.Route with
                {
                    RelatedReleaseSources =
                    [
                        MbSource(
                            "release",
                            "55555555-5555-5555-5555-555555555555")
                    ]
                }
            },
            "malformed-date" => item with
            {
                MusicBrainzRelease =
                    item.MusicBrainzRelease with
                    {
                        ReleaseDateEvidence =
                            new DiscogsOriginalRouteRetryRequest
                                .PartialDateData
                            {
                                Kind = "fullDate",
                                Year = 1983,
                                Month = 2
                            }
                    }
            },
            "malformed-row" => item with
            {
                MusicBrainzRelease =
                    item.MusicBrainzRelease with
                    {
                        Tracklist =
                        [
                            Assert.Single(
                                item.MusicBrainzRelease.Tracklist)
                                with
                                {
                                    ExternalSources = []
                                }
                        ]
                    }
            },
            "cross-release-snapshot" => item with
            {
                MusicBrainzRelease =
                    item.MusicBrainzRelease with
                    {
                        Source = MbSource(
                            "release",
                            "55555555-5555-5555-5555-555555555555")
                    }
            },
            _ => throw new ArgumentOutOfRangeException(
                nameof(vector))
        };
        return request with
        {
            RetryContext = request.RetryContext with
            {
                Items = [tampered]
            }
        };
    }
}
