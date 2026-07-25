using System.Net;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Fact]
    public async Task Recording_detail_preserves_raw_directed_relations_for_later_lineage_composition()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("recording-detail.json"))));
        using var harness = new ProviderHarness(handler, ValidOptions());

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.RecordingDetailOutcome> result =
            await harness.Provider.GetRecordingDetailAsync(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, result.Value.Relations.Count);
        Assert.Equal("backward", result.Value.Relations[0].Direction);
        Assert.Equal("work", result.Value.Relations[0].TargetType);
        Assert.Equal(["live"], result.Value.Relations[0].Attributes);
        Assert.Equal("recording", result.Value.Relations[1].TargetType);
        Assert.Equal("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", result.Value.Relations[1].TargetMbid);
    }

    [Fact]
    public async Task Disabled_provider_returns_typed_disabled_before_Http()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-detail.json"))));
        using var harness = new ProviderHarness(handler, ValidOptions(enabled: false));

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.Disabled, result.Error.Kind);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task Generic_operations_outside_the_Task_four_slice_return_unsupported_capability()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse("{}", HttpStatusCode.OK)));
        using var harness = new ProviderHarness(handler, ValidOptions());

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> releases =
            await harness.Provider.SearchReleasesAsync(
            new ExternalMetadataReleaseSearchQuery(Title: "Title"),
            CancellationToken.None);
        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>> artists =
            await harness.Provider.SearchArtistsAsync(
            new ExternalMetadataArtistSearchQuery("Artist"),
            CancellationToken.None);
        ExternalMetadataResult<ExternalMetadataArtistDetail> artist = await harness.Provider.GetArtistAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);
        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>> tracks =
            await harness.Provider.SearchTracksAsync(
            new ExternalMetadataTrackSearchQuery(Title: "Title"),
            CancellationToken.None);
        ExternalMetadataResult<ExternalMetadataTrackDetail> track = await harness.Provider.GetTrackAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);

        Assert.All(
            [releases.Error, artists.Error, artist.Error, tracks.Error, track.Error],
            error => Assert.Equal(ExternalMetadataErrorKind.UnsupportedCapability, error.Kind));
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task Retryable_failures_use_one_and_two_second_TimeProvider_delays()
    {
        var timeProvider = new FakeTimeProvider();
        int responses = 0;
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler((_, _) =>
        {
            responses++;
            return Task.FromResult(responses switch
            {
                1 => JsonResponse("{}", HttpStatusCode.InternalServerError),
                2 => JsonResponse("{}", HttpStatusCode.BadGateway),
                _ => JsonResponse(ReadFixture("release-detail.json"))
            });
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(maxRetries: 2),
            timeProvider,
            gate);

        Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> operation = harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);
        await handler.FirstRequest.WaitAsync(TimeSpan.FromSeconds(2));
        await Task.Delay(20);
        timeProvider.Advance(TimeSpan.FromSeconds(1));
        await WaitUntilAsync(() => handler.CallCount == 2);
        await Task.Delay(20);
        timeProvider.Advance(TimeSpan.FromSeconds(2));
        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await operation.WaitAsync(TimeSpan.FromSeconds(2));

        Assert.True(result.IsSuccess);
        Assert.Equal(3, handler.CallCount);
        Assert.Equal(3, gate.WaitCount);
    }

    [Fact]
    public async Task Operation_deadline_cancellation_maps_to_timeout()
    {
        var timeProvider = new FakeTimeProvider();
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler(async (_, cancellationToken) =>
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, timeProvider, cancellationToken);
            throw new InvalidOperationException("The timeout token should cancel the handler.");
        });
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(operationTimeoutSeconds: 10),
            timeProvider,
            gate);

        Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> operation = harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);
        await handler.FirstRequest.WaitAsync(TimeSpan.FromSeconds(2));
        timeProvider.Advance(TimeSpan.FromSeconds(10));
        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await operation.WaitAsync(TimeSpan.FromSeconds(2));

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.Timeout, result.Error.Kind);
    }

    [Fact]
    public async Task Release_group_failure_adds_context_warning_without_changing_chronology()
    {
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler((request, _) =>
        {
            string path = request.RequestUri!.PathAndQuery;
            return path.StartsWith("/ws/2/release?", StringComparison.Ordinal)
                ? Task.FromResult(JsonResponse(
                    path.Contains("offset=0", StringComparison.Ordinal)
                        ? ReadFixture("release-page-1.json")
                        : ReadFixture("release-page-2.json")))
                : Task.FromResult(JsonResponse("{}", HttpStatusCode.InternalServerError));
        });
        using var harness = new ProviderHarness(handler, ValidOptions(), requestGate: gate);

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result =
            await harness.Provider.BrowseReleasesAsync(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.ChronologyComplete);
        Assert.False(result.Value.ReleaseGroupContextComplete);
        Assert.Contains("musicbrainz.release_group_context_incomplete", result.Value.Warnings);
    }

    [Fact]
    public async Task Operation_attempt_budget_stops_release_browse_with_a_stable_warning()
    {
        string fullPage = ReadFixture("release-page-1.json").Replace(
            "\"release-count\": 3",
            "\"release-count\": 999",
            StringComparison.Ordinal);
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler((_, _) => Task.FromResult(JsonResponse(fullPage)));
        using var harness = new ProviderHarness(
            handler,
            ValidOptions(
                maxRequestsPerOperation: 5,
                maxReleasePages: 20,
                maxReleaseGroupLookups: 0),
            requestGate: gate);

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseBrowseOutcome> result =
            await harness.Provider.BrowseReleasesAsync(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.ChronologyComplete);
        Assert.Contains("musicbrainz.operation_budget_exhausted", result.Value.Warnings);
        Assert.Equal(5, handler.CallCount);
    }

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
        while (!condition())
        {
            await Task.Delay(10, timeout.Token);
        }
    }
}
