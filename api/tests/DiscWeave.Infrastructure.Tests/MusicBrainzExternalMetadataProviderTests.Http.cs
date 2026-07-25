using System.Net;
using System.Net.Http.Headers;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Fact]
    public async Task Recording_and_release_lookups_use_normalized_MBIDs_and_the_exact_includes()
    {
        var recordingHandler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("recording-detail.json"))));
        using var recordingHarness = new ProviderHarness(recordingHandler, ValidOptions());

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.RecordingDetailOutcome> recording =
            await recordingHarness.Provider.GetRecordingDetailAsync(
            " AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA ",
            CancellationToken.None);

        Assert.True(recording.IsSuccess);
        Assert.Equal(
            "/ws/2/recording/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" +
            "?inc=artist-credits+recording-rels+work-rels&fmt=json",
            Assert.Single(recordingHandler.Requests).RequestUri!.PathAndQuery);

        var releaseHandler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-detail.json"))));
        using var releaseHarness = new ProviderHarness(releaseHandler, ValidOptions());

        ExternalMetadataResult<ExternalMetadataReleaseDetail> release =
            await releaseHarness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);

        Assert.True(release.IsSuccess);
        Assert.Equal(
            "/ws/2/release/10000000-0000-0000-0000-000000000001" +
            "?inc=artist-credits+labels+recordings+release-groups+media+url-rels&fmt=json",
            Assert.Single(releaseHandler.Requests).RequestUri!.PathAndQuery);

        var groupHandler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-group-relations.json"))));
        using var groupHarness = new ProviderHarness(groupHandler, ValidOptions());

        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.ReleaseGroupDetailOutcome> group =
            await groupHarness.Provider.GetReleaseGroupDetailAsync(
            "20000000-0000-0000-0000-000000000001",
            CancellationToken.None);

        Assert.True(group.IsSuccess);
        Assert.Equal(
            "/ws/2/release-group/20000000-0000-0000-0000-000000000001" +
            "?inc=release-group-rels&fmt=json",
            Assert.Single(groupHandler.Requests).RequestUri!.PathAndQuery);
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound, ExternalMetadataErrorKind.NotFound)]
    [InlineData(HttpStatusCode.TooManyRequests, ExternalMetadataErrorKind.RateLimited)]
    [InlineData(HttpStatusCode.ServiceUnavailable, ExternalMetadataErrorKind.RateLimited)]
    [InlineData(HttpStatusCode.InternalServerError, ExternalMetadataErrorKind.Unavailable)]
    [InlineData(HttpStatusCode.BadGateway, ExternalMetadataErrorKind.Unavailable)]
    [InlineData(HttpStatusCode.GatewayTimeout, ExternalMetadataErrorKind.Unavailable)]
    public async Task MusicBrainz_statuses_map_to_stable_typed_failures(
        HttpStatusCode statusCode,
        ExternalMetadataErrorKind expectedKind)
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse("{}", statusCode)));
        using var harness = new ProviderHarness(handler, ValidOptions());

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(expectedKind, result.Error.Kind);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Malformed_successful_Json_maps_to_invalid_response()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("malformed.json"))));
        using var harness = new ProviderHarness(handler, ValidOptions());

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.InvalidResponse, result.Error.Kind);
    }

    [Fact]
    public async Task Invalid_MBID_is_rejected_before_Http()
    {
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(ReadFixture("release-detail.json"))));
        using var harness = new ProviderHarness(handler, ValidOptions());

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("{10000000-0000-0000-0000-000000000001}"),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.InvalidResponse, result.Error.Kind);
        Assert.Equal(0, handler.CallCount);
    }

    [Fact]
    public async Task Accepted_Retry_After_defers_the_gate_and_retries_once()
    {
        var timeProvider = new FakeTimeProvider();
        int handlerCallCount = 0;
        var handler = new CapturingHandler((_, _) =>
        {
            if (handlerCallCount == 0)
            {
                handlerCallCount++;
                HttpResponseMessage limited = JsonResponse("{}", HttpStatusCode.TooManyRequests);
                limited.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(3));
                return Task.FromResult(limited);
            }

            handlerCallCount++;
            return Task.FromResult(JsonResponse(ReadFixture("release-detail.json")));
        });
        using var harness = new ProviderHarness(handler, ValidOptions(maxRetries: 1), timeProvider);

        Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> operation = harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);
        await handler.FirstRequest.WaitAsync(TimeSpan.FromSeconds(2));
        timeProvider.Advance(TimeSpan.FromSeconds(3));
        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await operation.WaitAsync(TimeSpan.FromSeconds(2));

        Assert.True(result.IsSuccess);
        Assert.Equal(2, handler.CallCount);
    }

    [Fact]
    public async Task Retry_After_over_the_cap_returns_the_original_delay_without_retrying()
    {
        var handler = new CapturingHandler((_, _) =>
        {
            HttpResponseMessage limited = JsonResponse("{}", HttpStatusCode.TooManyRequests);
            limited.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(11));
            return Task.FromResult(limited);
        });
        using var harness = new ProviderHarness(handler, ValidOptions(maxRetries: 2));

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.RateLimited, result.Error.Kind);
        Assert.Equal(TimeSpan.FromSeconds(11), result.Error.RetryAfter);
        Assert.Equal(1, handler.CallCount);
    }

    [Fact]
    public async Task Caller_cancellation_cancels_only_its_wait_and_shared_fetch_can_fill_the_cache()
    {
        var releaseResponse = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new CapturingHandler(async (_, cancellationToken) =>
        {
            await releaseResponse.Task.WaitAsync(cancellationToken);
            return JsonResponse(ReadFixture("release-detail.json"));
        });
        using var harness = new ProviderHarness(handler, ValidOptions());
        using var cancellation = new CancellationTokenSource();

        Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> first = harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            cancellation.Token);
        await handler.FirstRequest.WaitAsync(TimeSpan.FromSeconds(2));
        cancellation.Cancel();

        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => first);
        _ = releaseResponse.TrySetResult();
        await Task.Delay(50);
        ExternalMetadataResult<ExternalMetadataReleaseDetail> second = await harness.Provider.GetReleaseAsync(
            new ExternalMetadataLookupQuery("10000000-0000-0000-0000-000000000001"),
            CancellationToken.None);

        Assert.True(second.IsSuccess);
        Assert.Equal(1, handler.CallCount);
    }
}
