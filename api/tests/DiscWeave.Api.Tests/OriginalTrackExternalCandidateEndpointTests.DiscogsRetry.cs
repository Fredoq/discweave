using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "Discogs route retry validates and forwards one bounded Recording context")]
    public async Task Discogs_route_retry_validates_and_forwards_one_bounded_Recording_context()
    {
        LocalOriginalCandidateResult local = EmptyLocalResult();
        var resolver = new CapturingRetryResolver();
        await using ApiTestHost host =
            await CreateRetryHostAsync(local, resolver);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external/discogs-routes/retry",
            RetryRequest());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(resolver.LastContext);
        _ = Assert.Single(resolver.LastContext.Items);
        Assert.Equal(0, resolver.ResolveCallCount);
        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "succeeded",
            document.RootElement.GetProperty("discogsStatus")
                .GetProperty("outcome").GetString());
        Assert.Equal(
            "musicbrainz",
            document.RootElement.GetProperty("discogsRetryContext")
                .GetProperty("recordingSource")
                .GetProperty("providerCode").GetString());
    }

    [Fact(DisplayName = "Discogs route retry rejects a noncanonical source before resolver work")]
    public async Task Discogs_route_retry_rejects_a_noncanonical_source_before_resolver_work()
    {
        LocalOriginalCandidateResult local = EmptyLocalResult();
        var resolver = new CapturingRetryResolver();
        await using ApiTestHost host =
            await CreateRetryHostAsync(local, resolver);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        DiscogsOriginalRouteRetryRequest request = RetryRequest();
        request = request with
        {
            RetryContext = request.RetryContext with
            {
                RecordingSource =
                    request.RetryContext.RecordingSource with
                    {
                        ProviderCode = "discogs"
                    }
            }
        };

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external/discogs-routes/retry",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(resolver.LastContext);
        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());
        Assert.Equal(
            "original_discovery.discogs_retry_invalid",
            document.RootElement.GetProperty("code").GetString());
    }

    [Fact(DisplayName = "Discogs route retry rejects null identifiers as typed invalid")]
    public async Task Discogs_route_retry_rejects_null_identifiers_as_typed_invalid()
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
                Items =
                [
                    item with
                    {
                        MusicBrainzRelease =
                            item.MusicBrainzRelease with
                            {
                                Identifiers = [null!]
                            }
                    }
                ]
            }
        };

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external/discogs-routes/retry",
            request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Null(resolver.LastContext);
    }

    private static DiscogsOriginalRouteRetryRequest RetryRequest()
    {
        const string recordingId =
            "11111111-1111-1111-1111-111111111111";
        const string releaseId =
            "22222222-2222-2222-2222-222222222222";
        const string groupId =
            "33333333-3333-3333-3333-333333333333";
        const string trackId =
            "44444444-4444-4444-4444-444444444444";
        ExternalOriginalCandidateSourceResponse recording =
            MbSource("recording", recordingId);
        var route = new DiscogsOriginalRouteRetryRequest.RouteData
        {
            ReleaseSource = MbSource("release", releaseId),
            ReleaseGroupSource = MbSource("release-group", groupId),
            Title = "Release",
            Date = new ExternalOriginalCandidatePartialDateResponse
            {
                Year = 1983
            },
            MediumPosition = "1",
            MusicBrainzTrackMbid = trackId,
            ReleaseGroupRerecordingContext = false,
            RelatedReleaseSources = [DiscogsSourceResponse("249504")]
        };
        var release = new DiscogsOriginalRouteRetryRequest.ReleaseData
        {
            Source = MbSource("release", releaseId),
            Title = "Release",
            Artists = ["Artist"],
            ReleaseDateEvidence =
                new DiscogsOriginalRouteRetryRequest.PartialDateData
                {
                    Kind = "year",
                    Year = 1983
                },
            Labels = ["Label"],
            Tracklist =
            [
                new DiscogsOriginalRouteRetryRequest.TrackData
                {
                    Title = "Song",
                    Position = "A1",
                    DurationMilliseconds = 180000,
                    Artists = ["Artist"],
                    Disc = "1",
                    Side = "A",
                    ExternalSources =
                    [
                        MbSource("track", trackId),
                        MbSource("recording", recordingId)
                    ]
                }
            ],
            Identifiers = [],
            CatalogNumber = "CAT-1",
            RelatedSources = [DiscogsSourceResponse("249504")],
            TracklistComplete = true
        };
        return new DiscogsOriginalRouteRetryRequest
        {
            RetryContext =
                new DiscogsOriginalRouteRetryRequest.ContextData
                {
                    RecordingSource = recording,
                    Items =
                    [
                        new DiscogsOriginalRouteRetryRequest.ItemData
                        {
                            Route = route,
                            MusicBrainzRelease = release
                        }
                    ]
                }
        };
    }

    private static ExternalOriginalCandidateSourceResponse MbSource(
        string resourceType,
        string id)
    {
        return new ExternalOriginalCandidateSourceResponse
        {
            ProviderCode = "musicbrainz",
            ResourceType = resourceType,
            ExternalId = id,
            SourceUrl =
                $"https://musicbrainz.org/{resourceType}/{id}",
            Attribution = "Data provided by MusicBrainz."
        };
    }

    private static ExternalOriginalCandidateSourceResponse
        DiscogsSourceResponse(string id)
    {
        return new ExternalOriginalCandidateSourceResponse
        {
            ProviderCode = "discogs",
            ResourceType = "release",
            ExternalId = id,
            SourceUrl = $"https://www.discogs.com/release/{id}",
            Attribution = "Data provided by Discogs."
        };
    }

    private sealed class CapturingRetryResolver
        : IExternalReleaseRouteResolver
    {
        public int ResolveCallCount { get; private set; }

        public DiscogsRouteRetryContext? LastContext { get; private set; }

        public Task<ExternalReleaseRouteBatchResolution> ResolveAsync(
            IReadOnlyList<ExternalReleaseRouteResolutionRequest> candidates,
            CancellationToken cancellationToken)
        {
            _ = candidates;
            cancellationToken.ThrowIfCancellationRequested();
            ResolveCallCount++;
            throw new NotSupportedException();
        }

        public Task<ExternalReleaseRouteBatchResolution> RetryAsync(
            DiscogsRouteRetryContext retryContext,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            LastContext = retryContext;
            var status = new ExternalProviderOperationStatus
            {
                ProviderCode = "discogs",
                Outcome = ExternalProviderOperationOutcome.Succeeded
            };
            var candidate = new ExternalReleaseCandidateRouteResolution
            {
                RecordingSource = retryContext.RecordingSource,
                Routes =
                [
                    .. retryContext.Items.Select(item =>
                        new ExternalReleaseRouteCandidate
                        {
                            MusicBrainzRoute = item.Route,
                            IsPreferred = false,
                            EvidenceCodes =
                                ["musicbrainz.release_route"]
                        })
                ],
                DiscogsStatus = status,
                Warnings = [],
                RetryContext = new DiscogsRouteRetryContext
                {
                    RecordingSource = retryContext.RecordingSource,
                    Items = []
                },
                AttemptedDiscogsRouteCount = retryContext.Items.Count,
                OutboundRequestCount = 0
            };
            return Task.FromResult(
                new ExternalReleaseRouteBatchResolution
                {
                    Candidates = [candidate],
                    DiscogsStatus = status,
                    AttemptedDiscogsRouteCount =
                        candidate.AttemptedDiscogsRouteCount,
                    OutboundRequestCount = 0,
                    Warnings = []
                });
        }
    }
}
