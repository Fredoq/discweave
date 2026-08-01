using System.Net;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    [Fact(DisplayName = "Resolver direct relationship wins without starting Discogs search")]
    public async Task Resolver_direct_relationship_wins_without_starting_Discogs_search()
    {
        RecordingReleaseRoute route =
            ResolverRoute(1, direct: false);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(route, RecordingMbid));
        RecordingHttpMessageHandler handler = DirectDiscogsHandler();
        MusicBrainzDiscogsReleaseResolver resolver =
            CreateResolver(musicBrainz, handler);

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(2, candidate.Routes.Count);
        Assert.True(candidate.Routes.Single(value =>
            value.DiscogsBinding is not null).IsPreferred);
        Assert.Equal(
            "https://www.discogs.com/release/249504",
            candidate.Routes.Single(value =>
                value.DiscogsBinding is not null)
                .DiscogsBinding!.ReleaseSource.SourceUrl);
        Assert.Equal(1, musicBrainz.GetReleaseCallCount);
        HttpRequestMessage request = Assert.Single(handler.Requests);
        Assert.Equal("/releases/249504", request.RequestUri!.AbsolutePath);
        Assert.Equal(1, candidate.OutboundRequestCount);
        Assert.Equal(1, candidate.AttemptedDiscogsRouteCount);
    }

    [Fact(DisplayName = "Resolver shares five ranked route lookups across candidates")]
    public async Task Resolver_shares_five_ranked_route_lookups_across_candidates()
    {
        const string secondRecording =
            "dddddddd-dddd-dddd-dddd-dddddddddddd";
        RecordingReleaseRoute[] firstRoutes =
        [
            .. Enumerable.Range(1, 4)
                .Select(value =>
                    ResolverRoute(value))
        ];
        RecordingReleaseRoute[] secondRoutes =
        [
            .. Enumerable.Range(5, 4)
                .Select(value =>
                    ResolverRoute(value))
        ];
        var musicBrainz = new ScriptedMusicBrainzProvider();
        foreach (RecordingReleaseRoute route in firstRoutes)
        {
            musicBrainz.Add(
                route,
                ResolverMusicBrainzRelease(route, RecordingMbid));
        }

        foreach (RecordingReleaseRoute route in secondRoutes)
        {
            musicBrainz.Add(
                route,
                ResolverMusicBrainzRelease(route, secondRecording));
        }

        RecordingHttpMessageHandler handler = DirectDiscogsHandler();
        MusicBrainzDiscogsReleaseResolver resolver =
            CreateResolver(musicBrainz, handler);

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [
                    Request(RecordingMbid, firstRoutes),
                    Request(secondRecording, secondRoutes)
                ],
                CancellationToken.None);

        Assert.Equal(5, result.AttemptedDiscogsRouteCount);
        Assert.Equal(5, result.OutboundRequestCount);
        Assert.Equal(5, handler.Requests.Count);
        Assert.Equal(5, musicBrainz.GetReleaseCallCount);
        Assert.Equal(
            [4, 1],
            result.Candidates.Select(value =>
                value.AttemptedDiscogsRouteCount));
        Assert.Equal(
            [4, 4],
            result.Candidates.Select(value =>
                value.Routes.Count(route =>
                    route.DiscogsBinding is null)));
        Assert.Empty(result.Candidates[0].RetryContext.Items);
        Assert.Empty(result.Candidates[1].RetryContext.Items);
        Assert.DoesNotContain(
            "discogs.lookup_limit_reached",
            result.Candidates[0].Warnings);
        Assert.Contains(
            "discogs.lookup_limit_reached",
            result.Candidates[1].Warnings);
    }

    [Fact(DisplayName = "Resolver bounds search details and counts every retry attempt")]
    public async Task Resolver_bounds_search_details_and_counts_every_retry_attempt()
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
        int searchAttempts = 0;
        RecordingHttpMessageHandler handler = new(request =>
        {
            string path = request.RequestUri!.AbsolutePath;
            return path == "/database/search" &&
                ++searchAttempts == 1
                    ? new HttpResponseMessage(
                        HttpStatusCode.ServiceUnavailable)
                    : path switch
                    {
                        "/database/search" =>
                            JsonResponse(
                                DiscogsSearch(100, 200, 300)),
                        "/releases/100" =>
                            JsonResponse(DiscogsDetail("100")),
                        _ => new HttpResponseMessage(
                            HttpStatusCode.ServiceUnavailable)
                    };
        });
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            handler,
            ResolverOptions(searchResults: 2));

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(5, handler.Requests.Count);
        Assert.Equal(
            2,
            handler.Requests.Count(request =>
                request.RequestUri!.AbsolutePath ==
                    "/database/search"));
        Assert.DoesNotContain(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath ==
                "/releases/300");
        Assert.Equal(5, candidate.OutboundRequestCount);
        Assert.Equal(
            ExternalProviderOperationOutcome.Succeeded,
            candidate.DiscogsStatus.Outcome);
        Assert.Contains("discogs.unavailable", candidate.Warnings);
        _ = Assert.Single(candidate.RetryContext.Items);
        Assert.Equal(
            1,
            candidate.Routes.Count(value =>
                value.DiscogsBinding is not null));
    }

    [Fact(DisplayName = "Retry repeats only bounded Discogs work and never MusicBrainz")]
    public async Task Retry_repeats_only_bounded_Discogs_work_and_never_MusicBrainz()
    {
        RecordingReleaseRoute route =
            ResolverRoute(1, direct: false);
        ExternalMetadataReleaseDetail release =
            ResolverMusicBrainzRelease(
                route,
                RecordingMbid,
                direct: false);
        var musicBrainz = new ScriptedMusicBrainzProvider
        {
            ThrowOnGetRelease = true
        };
        RecordingHttpMessageHandler handler = new(request =>
            request.RequestUri!.AbsolutePath == "/database/search"
                ? JsonResponse(DiscogsSearch(100))
                : JsonResponse(DiscogsDetail("100")));
        MusicBrainzDiscogsReleaseResolver resolver =
            CreateResolver(musicBrainz, handler);

        ExternalReleaseRouteBatchResolution result =
            await resolver.RetryAsync(
                new DiscogsRouteRetryContext
                {
                    RecordingSource =
                        MusicBrainzSource(
                            "recording",
                            RecordingMbid),
                    Items =
                    [
                        new DiscogsRouteRetryItem
                        {
                            Route = route,
                            MusicBrainzRelease = release
                        }
                    ]
                },
                CancellationToken.None);

        Assert.Equal(0, musicBrainz.GetReleaseCallCount);
        Assert.Equal(2, handler.Requests.Count);
        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(1, candidate.AttemptedDiscogsRouteCount);
        Assert.Equal(2, candidate.OutboundRequestCount);
        Assert.Empty(candidate.RetryContext.Items);
    }

    [Fact(DisplayName = "Budget exhaustion preserves fallbacks and completed routes")]
    public async Task Budget_exhaustion_preserves_fallbacks_and_completed_routes()
    {
        RecordingReleaseRoute first =
            ResolverRoute(1);
        RecordingReleaseRoute second =
            ResolverRoute(2);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            first,
            ResolverMusicBrainzRelease(first, RecordingMbid));
        musicBrainz.Add(
            second,
            ResolverMusicBrainzRelease(second, RecordingMbid));
        RecordingHttpMessageHandler handler = DirectDiscogsHandler();
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            handler,
            ResolverOptions(discoveryRequests: 1));

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, first, second)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        _ = Assert.Single(handler.Requests);
        Assert.Equal(2, candidate.Routes.Count(value =>
            value.DiscogsBinding is null));
        Assert.Equal(1, candidate.Routes.Count(value =>
            value.DiscogsBinding is not null));
        Assert.Contains(
            "discogs.request_budget_exhausted",
            candidate.Warnings);
        Assert.Equal(
            ExternalProviderOperationOutcome.Succeeded,
            candidate.DiscogsStatus.Outcome);
        _ = Assert.Single(candidate.RetryContext.Items);
    }

    [Fact(DisplayName = "An invalid null medium route makes zero provider calls")]
    public async Task An_invalid_null_medium_route_makes_zero_provider_calls()
    {
        RecordingReleaseRoute invalid =
            ResolverRoute(1, medium: "");
        var musicBrainz = new ScriptedMusicBrainzProvider();
        RecordingHttpMessageHandler handler = DirectDiscogsHandler();
        MusicBrainzDiscogsReleaseResolver resolver =
            CreateResolver(musicBrainz, handler);

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, invalid)],
                CancellationToken.None);

        Assert.Equal(0, musicBrainz.GetReleaseCallCount);
        Assert.Empty(handler.Requests);
        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        _ = Assert.Single(candidate.Routes);
        Assert.Contains(
            "musicbrainz.release_route_invalid",
            candidate.Warnings);
    }
}
