using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using System.Net;
using System.Net.Http.Headers;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzSharedDispatchTests
{
    [Fact]
    public async Task A_metadata_redirect_returns_a_recoverable_failure_without_another_dispatch()
    {
        var time = new ObservedTimeProvider();
        var handler = new DispatchHandler(time, (_, _, _) =>
        {
            var redirect = new HttpResponseMessage(HttpStatusCode.Redirect);
            redirect.Headers.Location = new Uri("https://musicbrainz.org/ws/2/recording/redirected?fmt=json");
            return Task.FromResult(redirect);
        });
        using var providers = new SharedProviders(time, handler);
        ExternalMetadataResult<MusicBrainzExternalMetadataProvider.RecordingSearchOutcome> result =
            await providers.SearchRecordingAsync().WaitAsync(TestTimeout);

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.InvalidResponse, result.Error.Kind);
        _ = Assert.Single(handler.Dispatches);
    }

    [Fact]
    public async Task A_paused_cover_dispatch_blocks_recording_search_until_headers_and_a_full_cooldown()
    {
        var time = new ObservedTimeProvider();
        var headers = new TaskCompletionSource<HttpResponseMessage>(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new DispatchHandler(time, (_, number, _) => number == 1
            ? headers.Task
            : Task.FromResult(JsonResponse("{\"recordings\":[],\"count\":0,\"offset\":0}")));
        using var providers = new SharedProviders(time, handler);
        Task cover = providers.SearchCoverAsync();
        _ = Assert.Single(handler.Dispatches);
        Task recording = providers.SearchRecordingAsync();
        time.Advance(TimeSpan.FromSeconds(5));
        _ = Assert.Single(handler.Dispatches);
        Assert.False(recording.IsCompleted);
        headers.SetResult(JsonResponse("{\"releases\":[]}"));
        await cover.WaitAsync(TestTimeout);
        Assert.Equal(TimeSpan.FromSeconds(1), await time.NextDelayAsync());
        time.Advance(TimeSpan.FromMilliseconds(999));
        _ = Assert.Single(handler.Dispatches);
        time.Advance(TimeSpan.FromMilliseconds(1));
        await recording.WaitAsync(TestTimeout);
        AssertSpaced(time, handler.Dispatches, 2);
        Assert.Equal(TimeSpan.FromSeconds(6), time.GetElapsedTime(handler.Dispatches[0].Timestamp, handler.Dispatches[1].Timestamp));
    }

    [Fact]
    public async Task A_metadata_retry_and_concurrent_cover_search_share_the_same_dispatch_cooldown()
    {
        var time = new ObservedTimeProvider();
        var handler = new DispatchHandler(time, (request, number, _) =>
        {
            if (number == 1)
            {
                var limited = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
                limited.Headers.RetryAfter = new RetryConditionHeaderValue(TimeSpan.FromSeconds(3));
                return Task.FromResult(limited);
            }

            return Task.FromResult((request.RequestUri ?? throw new InvalidOperationException("A dispatch requires a request URI")).AbsolutePath.Contains("recording", StringComparison.Ordinal)
                ? JsonResponse("{\"recordings\":[],\"count\":0,\"offset\":0}")
                : JsonResponse("{\"releases\":[]}"));
        });
        using var providers = new SharedProviders(time, handler);
        Task recording = providers.SearchRecordingAsync();
        Assert.Equal(TimeSpan.FromSeconds(3), await time.NextDelayAsync());
        Task cover = providers.SearchCoverAsync();
        time.Advance(TimeSpan.FromMilliseconds(2999));
        _ = Assert.Single(handler.Dispatches);
        time.Advance(TimeSpan.FromMilliseconds(1));
        Assert.Equal(TimeSpan.FromSeconds(1), await time.NextDelayAsync());
        time.Advance(TimeSpan.FromSeconds(1));
        await Task.WhenAll(recording, cover).WaitAsync(TestTimeout);
        AssertSpaced(time, handler.Dispatches, 3);
        Assert.Equal(TimeSpan.FromSeconds(3), time.GetElapsedTime(handler.Dispatches[0].Timestamp, handler.Dispatches[1].Timestamp));
    }

    [Fact]
    public async Task A_cover_redirect_back_to_MusicBrainz_is_gated_with_concurrent_recording_requests()
    {
        var time = new ObservedTimeProvider();
        var handler = new DispatchHandler(time, (request, number, _) =>
        {
            if (number == 1)
            {
                var redirect = new HttpResponseMessage(HttpStatusCode.Redirect);
                redirect.Headers.Location = new Uri("https://musicbrainz.org/ws/2/release/redirected?fmt=json");
                return Task.FromResult(redirect);
            }

            return Task.FromResult((request.RequestUri ?? throw new InvalidOperationException("A dispatch requires a request URI")).AbsolutePath.Contains("recording", StringComparison.Ordinal)
                ? JsonResponse("{\"recordings\":[],\"count\":0,\"offset\":0}")
                : JsonResponse("{\"releases\":[]}"));
        });
        using var providers = new SharedProviders(time, handler);
        Task cover = providers.SearchCoverAsync();
        Assert.Equal(TimeSpan.FromSeconds(1), await time.NextDelayAsync());
        Task recording = providers.SearchRecordingAsync();
        time.Advance(TimeSpan.FromSeconds(1));
        Assert.Equal(TimeSpan.FromSeconds(1), await time.NextDelayAsync());
        time.Advance(TimeSpan.FromSeconds(1));
        await Task.WhenAll(cover, recording).WaitAsync(TestTimeout);
        AssertSpaced(time, handler.Dispatches, 3);
        Assert.Contains(handler.Dispatches, dispatch => dispatch.Uri.AbsolutePath.EndsWith("/redirected", StringComparison.Ordinal));
    }
}
