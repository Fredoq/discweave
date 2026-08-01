using System.Net;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    [Fact(DisplayName = "Two matched releases leave candidate preference unset")]
    public async Task Two_matched_releases_leave_candidate_preference_unset()
    {
        RecordingReleaseRoute first = ResolverRoute(1);
        RecordingReleaseRoute second = ResolverRoute(2);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            first,
            ResolverMusicBrainzRelease(first, RecordingMbid));
        musicBrainz.Add(
            second,
            ResolverMusicBrainzRelease(second, RecordingMbid));
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            DirectDiscogsHandler());

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, first, second)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(
            2,
            candidate.Routes.Count(route =>
                route.DiscogsBinding is not null));
        Assert.DoesNotContain(
            candidate.Routes,
            route => route.IsPreferred);
    }

    [Fact(DisplayName = "Route request exhaustion preserves fallback and retry state")]
    public async Task Route_request_exhaustion_preserves_fallback_and_retry_state()
    {
        RecordingReleaseRoute route =
            ResolverRoute(1, direct: false);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(
                route,
                RecordingMbid,
                direct: false));
        RecordingHttpMessageHandler handler = new(_ =>
            new HttpResponseMessage(
                HttpStatusCode.ServiceUnavailable));
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            handler,
            ResolverOptions(routeRequests: 1));

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        _ = Assert.Single(handler.Requests);
        _ = Assert.Single(candidate.Routes);
        _ = Assert.Single(candidate.RetryContext.Items);
        Assert.Contains(
            "discogs.route_request_budget_exhausted",
            candidate.Warnings);
        Assert.Equal(
            ExternalProviderOperationOutcome.Unavailable,
            candidate.DiscogsStatus.Outcome);
        Assert.Equal(
            "discogs.route_request_budget_exhausted",
            candidate.DiscogsStatus.ErrorCode);
    }

    [Fact(DisplayName = "Expired discovery deadline preserves fallback with timeout status")]
    public async Task Expired_discovery_deadline_preserves_fallback_with_timeout_status()
    {
        RecordingReleaseRoute route = ResolverRoute(1);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(route, RecordingMbid));
        var handler = new BlockingHttpMessageHandler();
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            handler,
            ResolverOptions(timeoutSeconds: 5));

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        _ = Assert.Single(candidate.Routes);
        Assert.Equal(1, handler.RequestCount);
        Assert.Contains("discogs.timeout", candidate.Warnings);
        Assert.Equal(
            ExternalProviderOperationOutcome.Timeout,
            candidate.DiscogsStatus.Outcome);
        Assert.Equal("discogs.timeout", result.DiscogsStatus.ErrorCode);
    }

    [Fact(DisplayName = "Deadline never pairs a later route with an earlier MusicBrainz snapshot")]
    public async Task Deadline_never_pairs_a_later_route_with_an_earlier_MusicBrainz_snapshot()
    {
        RecordingReleaseRoute first = ResolverRoute(1);
        RecordingReleaseRoute second = ResolverRoute(2);
        var musicBrainz = new ScriptedMusicBrainzProvider
        {
            BlockOnReleaseId = second.ReleaseSource.ExternalId
        };
        musicBrainz.Add(
            first,
            ResolverMusicBrainzRelease(first, RecordingMbid));
        musicBrainz.Add(
            second,
            ResolverMusicBrainzRelease(second, RecordingMbid));
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            DirectDiscogsHandler(),
            ResolverOptions(timeoutSeconds: 5));

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, first, second)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Empty(candidate.RetryContext.Items);
        Assert.Contains("discogs.timeout", candidate.Warnings);
        Assert.Equal(
            2,
            candidate.Routes.Count(route =>
                route.DiscogsBinding is null));
        _ = Assert.Single(
            candidate.Routes,
            route => route.DiscogsBinding is not null);
    }

    private sealed class BlockingHttpMessageHandler : HttpMessageHandler
    {
        public int RequestCount { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            _ = request;
            RequestCount++;
            await Task.Delay(
                Timeout.InfiniteTimeSpan,
                cancellationToken);
            throw new InvalidOperationException(
                "The cancellation deadline must stop the request");
        }
    }
}
