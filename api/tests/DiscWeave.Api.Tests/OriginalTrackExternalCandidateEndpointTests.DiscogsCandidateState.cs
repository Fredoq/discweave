using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "External candidates retain distinct Discogs state and one global status")]
    public async Task External_candidates_retain_distinct_Discogs_state_and_one_global_status()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var successfulId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var timeoutId = Guid.Parse(
            "22222222-2222-2222-2222-222222222222");
        RecordingReleaseRoute successfulRoute = Route(
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            1983);
        RecordingReleaseRoute timeoutRoute = Route(
            Guid.Parse("44444444-4444-4444-4444-444444444444"),
            1984);
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [
                        LineageCandidate(
                            successfulId,
                            [Relation(selectedId, successfulId)],
                            [successfulRoute]),
                        LineageCandidate(
                            timeoutId,
                            [Relation(selectedId, timeoutId)],
                            [timeoutRoute])
                    ],
                    RecordingSource(selectedId)))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();
        var resolver = new MixedCandidateRouteResolver(
            successfulId.ToString("D"),
            timeoutId.ToString("D"));
        await using ApiTestHost host =
            await CreateHostWithRouteResolverAsync(
                local,
                resolver,
                provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsJsonAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external",
            new { providerCodes = _musicBrainzProviderCodes });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, resolver.ResolveCallCount);
        Assert.Equal(2, resolver.CandidateCount);
        Assert.True(resolver.OutboundRequestCount <= 25);
        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());
        JsonElement root = document.RootElement;
        JsonElement globalDiscogs = root.GetProperty("providerStatuses")
            .EnumerateArray()
            .Single(value =>
                value.GetProperty("providerCode").GetString()
                    == "discogs");
        Assert.Equal(
            "succeeded",
            globalDiscogs.GetProperty("outcome").GetString());
        JsonElement[] items =
            [.. root.GetProperty("items").EnumerateArray()];
        JsonElement successful = items.Single(value =>
            value.GetProperty("recordingSource")
                .GetProperty("externalId").GetString()
                    == successfulId.ToString("D"));
        JsonElement timeout = items.Single(value =>
            value.GetProperty("recordingSource")
                .GetProperty("externalId").GetString()
                    == timeoutId.ToString("D"));
        Assert.Equal(
            "succeeded",
            successful.GetProperty("discogsStatus")
                .GetProperty("outcome").GetString());
        Assert.Empty(
            successful.GetProperty("discogsRetryContext")
                .GetProperty("items").EnumerateArray());
        Assert.Equal(
            "timeout",
            timeout.GetProperty("discogsStatus")
                .GetProperty("outcome").GetString());
        _ = Assert.Single(
            timeout.GetProperty("discogsRetryContext")
                .GetProperty("items").EnumerateArray());
        Assert.Equal(
            ["discogs.timeout"],
            timeout.GetProperty("discogsWarnings")
                .EnumerateArray()
                .Select(value => value.GetString()));
        Assert.Equal(
            ["discogs.timeout"],
            root.GetProperty("warnings")
                .EnumerateArray()
                .Select(value => value.GetString()));
    }

    private sealed class MixedCandidateRouteResolver
        : IExternalReleaseRouteResolver
    {
        private readonly string _successfulId;
        private readonly string _timeoutId;

        public MixedCandidateRouteResolver(
            string successfulId,
            string timeoutId)
        {
            _successfulId = successfulId;
            _timeoutId = timeoutId;
        }

        public int ResolveCallCount { get; private set; }

        public int CandidateCount { get; private set; }

        public int OutboundRequestCount { get; private set; }

        public Task<ExternalReleaseRouteBatchResolution> ResolveAsync(
            IReadOnlyList<ExternalReleaseRouteResolutionRequest> candidates,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            ResolveCallCount++;
            CandidateCount = candidates.Count;
            ExternalReleaseCandidateRouteResolution[] results =
            [
                .. candidates.Select(candidate =>
                    CreateCandidate(
                        candidate,
                        string.Equals(
                            candidate.RecordingSource.ExternalId,
                            _successfulId,
                            StringComparison.Ordinal)))
            ];
            Assert.Contains(
                results,
                value => value.RecordingSource.ExternalId == _timeoutId);
            OutboundRequestCount =
                results.Sum(value => value.OutboundRequestCount);
            ExternalProviderOperationStatus globalStatus = Status(
                ExternalProviderOperationOutcome.Succeeded);
            return Task.FromResult(
                new ExternalReleaseRouteBatchResolution
                {
                    Candidates = results,
                    DiscogsStatus = globalStatus,
                    AttemptedDiscogsRouteCount =
                        results.Sum(value =>
                            value.AttemptedDiscogsRouteCount),
                    OutboundRequestCount = OutboundRequestCount,
                    Warnings = ["discogs.timeout"]
                });
        }

        public Task<ExternalReleaseRouteBatchResolution> RetryAsync(
            DiscogsRouteRetryContext retryContext,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        private static ExternalReleaseCandidateRouteResolution
            CreateCandidate(
                ExternalReleaseRouteResolutionRequest request,
                bool succeeded)
        {
            RecordingReleaseRoute route =
                Assert.Single(request.MusicBrainzRoutes);
            ExternalReleaseRouteCandidate fallback = new()
            {
                MusicBrainzRoute = route,
                IsPreferred = false,
                EvidenceCodes = ["musicbrainz.release_route"]
            };
            ExternalReleaseRouteCandidate[] routes = succeeded
                ?
                [
                    fallback,
                    fallback with
                    {
                        DiscogsBinding =
                            new DiscogsReleaseRouteBinding
                            {
                                ReleaseSource =
                                    new ExternalMetadataSource(
                                        "discogs",
                                        "release",
                                        "249504",
                                        "https://www.discogs.com/release/249504",
                                        "Data provided by Discogs."),
                                RowOrdinal = 0,
                                Position = "A1",
                                Fingerprint =
                                    new string('a', 64)
                            },
                        IsPreferred = true,
                        EvidenceCodes =
                            ["discogs.direct_relationship"]
                    }
                ]
                : [fallback];
            DiscogsRouteRetryContext retryContext = new()
            {
                RecordingSource = request.RecordingSource,
                Items = succeeded
                    ? []
                    :
                    [
                        new DiscogsRouteRetryItem
                        {
                            Route = route,
                            MusicBrainzRelease =
                                RetryRelease(route)
                        }
                    ]
            };
            return new ExternalReleaseCandidateRouteResolution
            {
                RecordingSource = request.RecordingSource,
                Routes = routes,
                DiscogsStatus = Status(
                    succeeded
                        ? ExternalProviderOperationOutcome.Succeeded
                        : ExternalProviderOperationOutcome.Timeout),
                Warnings = succeeded ? [] : ["discogs.timeout"],
                RetryContext = retryContext,
                AttemptedDiscogsRouteCount = 1,
                OutboundRequestCount = succeeded ? 1 : 2
            };
        }

        private static ExternalProviderOperationStatus Status(
            ExternalProviderOperationOutcome outcome)
        {
            return new ExternalProviderOperationStatus
            {
                ProviderCode = "discogs",
                Outcome = outcome,
                ErrorCode = outcome ==
                    ExternalProviderOperationOutcome.Timeout
                        ? "discogs.timeout"
                        : null
            };
        }

        private static ExternalMetadataReleaseDetail RetryRelease(
            RecordingReleaseRoute route)
        {
            return new ExternalMetadataReleaseDetail(
                route.ReleaseSource,
                route.Title,
                ["Artist"],
                route.Date?.Year,
                null,
                [],
                [],
                null,
                [],
                [],
                [],
                null,
                [],
                [],
                relatedSources: []);
        }
    }
}
