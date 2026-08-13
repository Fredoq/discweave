using System.Net;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    private static MusicBrainzDiscogsReleaseResolver CreateResolver(
        ScriptedMusicBrainzProvider musicBrainz,
        HttpMessageHandler handler,
        DiscogsOptions? options = null)
    {
        DiscogsOptions configured = options ?? ResolverOptions();
        var discogs = new DiscogsExternalMetadataProvider(
            new HttpClient(handler)
            {
                BaseAddress = new Uri("https://api.discogs.test")
            },
            Options.Create(configured),
            new FixedDiscogsAccessTokenProvider("test-token"));
        return new MusicBrainzDiscogsReleaseResolver(
            new ExternalMetadataProviderResolver([musicBrainz]),
            discogs,
            new MusicBrainzDiscogsReleaseMatcher(),
            Options.Create(configured));
    }

    private static DiscogsOptions ResolverOptions(
        int lookups = 5,
        int searchResults = 3,
        int routeRequests = 12,
        int discoveryRequests = 25,
        int timeoutSeconds = 30)
    {
        return new DiscogsOptions
        {
            UserAgent = "DiscWeave.Tests/1.0",
            BaseUrl = "https://api.discogs.test",
            TimeoutSeconds = 10,
            MaxOriginalRouteLookups = lookups,
            MaxOriginalSearchResultsPerRoute = searchResults,
            MaxOriginalRequestsPerRoute = routeRequests,
            MaxOriginalRequestsPerDiscovery = discoveryRequests,
            OriginalDiscoveryTimeoutSeconds = timeoutSeconds
        };
    }

    private static ExternalReleaseRouteResolutionRequest Request(
        string recordingId,
        params RecordingReleaseRoute[] routes)
    {
        return new ExternalReleaseRouteResolutionRequest
        {
            RecordingSource = MusicBrainzSource("recording", recordingId),
            MusicBrainzRoutes = routes
        };
    }

    private static RecordingReleaseRoute ResolverRoute(
        int ordinal,
        bool direct = true,
        string medium = "1")
    {
        string releaseId =
            $"00000000-0000-0000-0000-{ordinal:D12}";
        string groupId =
            $"10000000-0000-0000-0000-{ordinal:D12}";
        return new RecordingReleaseRoute
        {
            ReleaseSource = MusicBrainzSource("release", releaseId),
            ReleaseGroupSource =
                MusicBrainzSource("release-group", groupId),
            Title = "Blue Monday",
            Date = new ProviderPartialDate { Year = 1983 },
            MediumPosition = medium,
            MusicBrainzTrackMbid = TrackMbid,
            ReleaseGroupRerecordingContext = false,
            RelatedReleaseSources = direct
                ? [DiscogsSource("249504")]
                : []
        };
    }

    private static ExternalMetadataReleaseDetail ResolverMusicBrainzRelease(
        RecordingReleaseRoute route,
        string recordingId,
        bool direct = true)
    {
        var row = new ExternalMetadataReleaseTrack(
            "Blue Monday",
            "A1",
            TimeSpan.FromMinutes(3),
            ["New Order"],
            "1",
            null,
            externalSources:
            [
                MusicBrainzSource("track", TrackMbid),
                MusicBrainzSource("recording", recordingId)
            ]);
        return new ExternalMetadataReleaseDetail(
            route.ReleaseSource,
            "Blue Monday",
            ["New Order"],
            null,
            null,
            ["Factory"],
            ["Vinyl"],
            "single",
            ["Electronic"],
            [row],
            [new ExternalMetadataIdentifier(
                "Barcode",
                "5016839200371")],
            "FAC 73",
            [new ExternalMetadataReleaseLabel("Factory", "FAC 73")],
            [],
            relatedSources: direct ? [DiscogsSource("249504")] : [],
            releaseDateEvidence: Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForYear(1983)),
            tracklistComplete: true);
    }

    private static RecordingHttpMessageHandler DirectDiscogsHandler()
    {
        return new RecordingHttpMessageHandler(request =>
            JsonResponse(DiscogsDetail("249504")));
    }

    private static HttpResponseMessage JsonResponse(string json)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json)
        };
    }

    private static string DiscogsSearch(params int[] ids)
    {
        string results = string.Join(
            ',',
            ids.Select(id =>
                $$"""{"type":"release","id":{{id}},"title":"New Order - Blue Monday","year":1983,"label":["Factory"],"format":["Vinyl"],"catno":"FAC 73","barcode":["5016839200371"],"uri":"/release/{{id}}"}"""));
        return $$"""{"pagination":{"items":{{ids.Length}}},"results":[{{results}}]}""";
    }

    private static string DiscogsDetail(string id)
    {
        return $$"""
            {
              "id": {{id}},
              "title": "Blue Monday",
              "uri": "/release/{{id}}-new-order-blue-monday",
              "year": 1983,
              "released": "1983",
              "artists": [{ "id": 1, "name": "New Order" }],
              "labels": [{ "name": "Factory", "catno": "FAC 73" }],
              "identifiers": [{ "type": "Barcode", "value": "5016839200371" }],
              "tracklist": [
                {
                  "type_": "track",
                  "title": "Blue Monday",
                  "position": "A1",
                  "duration": "3:00",
                  "artists": [{ "id": 1, "name": "New Order" }]
                }
              ]
            }
            """;
    }

    private sealed class ScriptedMusicBrainzProvider
        : IExternalMetadataProvider
    {
        private readonly Dictionary<string, ExternalMetadataReleaseDetail>
            _releases = new(StringComparer.Ordinal);

        public string ProviderCode => "musicbrainz";

        public int GetReleaseCallCount { get; private set; }

        public bool ThrowOnGetRelease { get; set; }

        public string? BlockOnReleaseId { get; set; }

        public void Add(
            RecordingReleaseRoute route,
            ExternalMetadataReleaseDetail release)
        {
            _releases[route.ReleaseSource.ExternalId] = release;
        }

        public async Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>>
            GetReleaseAsync(
                ExternalMetadataLookupQuery query,
                CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            GetReleaseCallCount++;
            if (string.Equals(
                query.ExternalId,
                BlockOnReleaseId,
                StringComparison.Ordinal))
            {
                await Task.Delay(
                    Timeout.InfiniteTimeSpan,
                    cancellationToken);
            }

            return ThrowOnGetRelease
                ? throw new InvalidOperationException(
                    "MusicBrainz must not be called")
                : new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
                    _releases[query.ExternalId]);
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>> SearchReleasesAsync(
            ExternalMetadataReleaseSearchQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>>> SearchArtistsAsync(
            ExternalMetadataArtistSearchQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataArtistDetail>> GetArtistAsync(
            ExternalMetadataLookupQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>>> SearchTracksAsync(
            ExternalMetadataTrackSearchQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataTrackDetail>> GetTrackAsync(
            ExternalMetadataLookupQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }
    }
}
