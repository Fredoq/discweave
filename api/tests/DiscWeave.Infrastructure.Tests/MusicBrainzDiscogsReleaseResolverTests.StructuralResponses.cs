using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    [Fact(DisplayName = "Retry rejects a release snapshot from another route")]
    public async Task Retry_rejects_a_release_snapshot_from_another_route()
    {
        RecordingReleaseRoute route = ResolverRoute(1);
        RecordingReleaseRoute other = ResolverRoute(2);
        RecordingHttpMessageHandler handler =
            DirectDiscogsHandler();
        MusicBrainzDiscogsReleaseResolver resolver = CreateResolver(
            new ScriptedMusicBrainzProvider(),
            handler);

        _ = await Assert.ThrowsAsync<ArgumentException>(() =>
            resolver.RetryAsync(
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
                            MusicBrainzRelease =
                                ResolverMusicBrainzRelease(
                                    other,
                                    RecordingMbid)
                        }
                    ]
                },
                CancellationToken.None));

        Assert.Empty(handler.Requests);
    }

    [Theory(DisplayName = "Invalid Discogs search structures preserve the MusicBrainz fallback")]
    [InlineData("{}")]
    [InlineData(/*lang=json,strict*/ """{"results":null}""")]
    [InlineData(/*lang=json,strict*/ """{"results":[null]}""")]
    public async Task Invalid_Discogs_search_structures_preserve_the_MusicBrainz_fallback(
        string payload)
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
            JsonResponse(payload));
        MusicBrainzDiscogsReleaseResolver resolver =
            CreateResolver(musicBrainz, handler);

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        AssertInvalidDiscogsFallback(result);
    }

    [Theory(DisplayName = "Invalid Discogs detail tracklists preserve the MusicBrainz fallback")]
    [InlineData("missing")]
    [InlineData("null")]
    [InlineData("null-row")]
    public async Task Invalid_Discogs_detail_tracklists_preserve_the_MusicBrainz_fallback(
        string vector)
    {
        RecordingReleaseRoute route = ResolverRoute(1);
        var musicBrainz = new ScriptedMusicBrainzProvider();
        musicBrainz.Add(
            route,
            ResolverMusicBrainzRelease(
                route,
                RecordingMbid));
        string tracklist = vector switch
        {
            "missing" => string.Empty,
            "null" => "\"tracklist\": null,",
            "null-row" => "\"tracklist\": [null],",
            _ => throw new ArgumentOutOfRangeException(
                nameof(vector))
        };
        string payload =
            $$"""
              {
                "id": 249504,
                "title": "Blue Monday",
                "uri": "/release/249504",
                {{tracklist}}
                "artists": []
              }
              """;
        RecordingHttpMessageHandler handler = new(_ =>
            JsonResponse(payload));
        MusicBrainzDiscogsReleaseResolver resolver =
            CreateResolver(musicBrainz, handler);

        ExternalReleaseRouteBatchResolution result =
            await resolver.ResolveAsync(
                [Request(RecordingMbid, route)],
                CancellationToken.None);

        AssertInvalidDiscogsFallback(result);
    }

    private static void AssertInvalidDiscogsFallback(
        ExternalReleaseRouteBatchResolution result)
    {
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
}
