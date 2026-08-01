using System.Net;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    [Fact(DisplayName = "Timeout is scoped to the attempted candidate")]
    public async Task Timeout_is_scoped_to_the_attempted_candidate()
    {
        const string secondRecording =
            "dddddddd-dddd-dddd-dddd-dddddddddddd";
        RecordingReleaseRoute first = ResolverRoute(1);
        RecordingReleaseRoute second = ResolverRoute(2);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            first,
            ResolverMusicBrainzRelease(first, RecordingMbid));
        musicBrainz.Add(
            second,
            ResolverMusicBrainzRelease(second, secondRecording));
        var handler = new BlockingHttpMessageHandler();
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            handler,
            ResolverOptions(timeoutSeconds: 5));

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [
                    Request(RecordingMbid, first),
                    Request(secondRecording, second)
                ],
                CancellationToken.None);

        Assert.Contains(
            "discogs.timeout",
            result.Candidates[0].Warnings);
        Assert.DoesNotContain(
            "discogs.timeout",
            result.Candidates[1].Warnings);
        Assert.Contains(
            "discogs.lookup_skipped_after_timeout",
            result.Candidates[1].Warnings);
        Assert.Equal(
            [1, 0],
            result.Candidates.Select(candidate =>
                candidate.AttemptedDiscogsRouteCount));
    }

    [Theory(DisplayName = "Invalid Discogs detail identity preserves the MusicBrainz fallback")]
    [InlineData("missing")]
    [InlineData("mismatched")]
    public async Task Invalid_Discogs_detail_identity_preserves_the_MusicBrainz_fallback(
        string vector)
    {
        RecordingReleaseRoute route = ResolverRoute(1);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(route, RecordingMbid));
        string invalidDetail = vector == "missing"
            ? DiscogsDetail("249504")
                .Replace("\"id\": 249504,", string.Empty)
            : DiscogsDetail("249505");
        RecordingHttpMessageHandler handler = new(request =>
            request.RequestUri!.AbsolutePath == "/releases/249504"
                ? JsonResponse(invalidDetail)
                : JsonResponse(DiscogsSearch()));
        MusicBrainzDiscogsReleaseResolver resolver =
            CreateResolver(musicBrainz, handler);

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        _ = Assert.Single(candidate.Routes);
        Assert.Null(candidate.Routes[0].DiscogsBinding);
        Assert.Equal(
            ExternalProviderOperationOutcome.InvalidResponse,
            candidate.DiscogsStatus.Outcome);
        Assert.Contains(
            "discogs.invalid_response",
            candidate.Warnings);
        _ = Assert.Single(candidate.RetryContext.Items);
    }

    [Fact(DisplayName = "Retry budget exhaustion retains every unprocessed item")]
    public async Task Retry_budget_exhaustion_retains_every_unprocessed_item()
    {
        RecordingReleaseRoute[] routes =
        [
            ResolverRoute(1),
            ResolverRoute(2),
            ResolverRoute(3)
        ];
        RecordingHttpMessageHandler handler = new(_ =>
            new HttpResponseMessage(
                HttpStatusCode.ServiceUnavailable));
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            new ScriptedMusicBrainzProvider(),
            handler,
            ResolverOptions(discoveryRequests: 1));

        ExternalReleaseRouteBatchResolution result =
            await resolver.RetryAsync(
                RetryContext(routes),
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(3, candidate.RetryContext.Items.Count);
        Assert.Equal(
            routes.Select(route => route.ReleaseSource.ExternalId),
            candidate.RetryContext.Items.Select(item =>
                item.Route.ReleaseSource.ExternalId));
    }

    [Fact(DisplayName = "Retry deadline retains every unprocessed item")]
    public async Task Retry_deadline_retains_every_unprocessed_item()
    {
        RecordingReleaseRoute[] routes =
        [
            ResolverRoute(1),
            ResolverRoute(2),
            ResolverRoute(3)
        ];
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            new ScriptedMusicBrainzProvider(),
            new BlockingHttpMessageHandler(),
            ResolverOptions(timeoutSeconds: 5));

        ExternalReleaseRouteBatchResolution result =
            await resolver.RetryAsync(
                RetryContext(routes),
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Equal(3, candidate.RetryContext.Items.Count);
        Assert.Equal(
            routes.Select(route => route.ReleaseSource.ExternalId),
            candidate.RetryContext.Items.Select(item =>
                item.Route.ReleaseSource.ExternalId));
    }

    [Fact(DisplayName = "Equal search relevance is tied by numeric release ID before the cap")]
    public async Task Equal_search_relevance_is_tied_by_numeric_release_ID_before_the_cap()
    {
        RecordingReleaseRoute route = ResolverRoute(1, direct: false);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(
                route,
                RecordingMbid,
                direct: false));
        RecordingHttpMessageHandler handler = new(request =>
            request.RequestUri!.AbsolutePath == "/database/search"
                ? JsonResponse(DiscogsSearch(200, 100))
                : JsonResponse(
                    DiscogsDetail(
                        request.RequestUri!.AbsolutePath[10..])));
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            musicBrainz,
            handler,
            ResolverOptions(searchResults: 1));

        _ = await resolver.ResolveAsync(
            [Request(RecordingMbid, route)],
            CancellationToken.None);

        Assert.Contains(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath ==
                "/releases/100");
        Assert.DoesNotContain(
            handler.Requests,
            request => request.RequestUri!.AbsolutePath ==
                "/releases/200");
    }

    [Fact(DisplayName = "Contradicted compatible rows emit match not found")]
    public async Task Contradicted_compatible_rows_emit_match_not_found()
    {
        RecordingReleaseRoute route = ResolverRoute(1, direct: false);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(
                route,
                RecordingMbid,
                direct: false));
        RecordingHttpMessageHandler handler = new(request =>
            request.RequestUri!.AbsolutePath == "/database/search"
                ? JsonResponse(DiscogsSearch(100))
                : JsonResponse(
                    DiscogsDetail("100")
                        .Replace("FAC 73", "OTHER")));
        MusicBrainzDiscogsReleaseResolver resolver =
            CreateResolver(musicBrainz, handler);

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        ExternalReleaseCandidateRouteResolution candidate =
            Assert.Single(result.Candidates);
        Assert.Contains(
            "discogs.match_not_found",
            candidate.Warnings);
        Assert.DoesNotContain(
            candidate.Routes,
            candidateRoute =>
                candidateRoute.DiscogsBinding is not null);
    }

    private static DiscogsRouteRetryContext RetryContext(
        IReadOnlyList<RecordingReleaseRoute> routes)
    {
        return new DiscogsRouteRetryContext
        {
            RecordingSource =
                MusicBrainzSource("recording", RecordingMbid),
            Items =
            [
                .. routes.Select(route => new DiscogsRouteRetryItem
                {
                    Route = route,
                    MusicBrainzRelease =
                        ResolverMusicBrainzRelease(
                            route,
                            RecordingMbid)
                })
            ]
        };
    }
}
