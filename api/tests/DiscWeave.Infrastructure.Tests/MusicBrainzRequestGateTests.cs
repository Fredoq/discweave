using System.Net;
using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed class MusicBrainzRequestGateTests
{
    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(999)]
    public void Constructor_rejects_intervals_below_one_second(int milliseconds)
    {
        _ = Assert.Throws<ArgumentOutOfRangeException>(() => new MusicBrainzRequestGate(
            Options.Create(new MusicBrainzOptions { MinimumRequestIntervalMilliseconds = milliseconds }), TimeProvider.System));
    }

    [Fact]
    public async Task SendAsync_allows_the_first_dispatch_without_advancing_time()
    {
        var time = new FakeTimeProvider();
        using MusicBrainzRequestGate gate = CreateGate(time);
        long initial = time.GetTimestamp();
        using HttpResponseMessage response = await gate.SendAsync(ResponseAsync, CancellationToken.None);
        Assert.Equal(initial, time.GetTimestamp());
    }

    [Fact]
    public async Task Concurrent_dispatches_are_spaced_after_prior_headers_complete()
    {
        var time = new FakeTimeProvider();
        using MusicBrainzRequestGate gate = CreateGate(time);
        var paused = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        List<long> starts = [];
        Task<HttpResponseMessage> first = gate.SendAsync(async token =>
        {
            await paused.Task.WaitAsync(token);
            starts.Add(time.GetTimestamp());
            return await ResponseAsync(token);
        }, CancellationToken.None);
        Task<HttpResponseMessage> second = gate.SendAsync(token =>
        {
            starts.Add(time.GetTimestamp());
            return ResponseAsync(token);
        }, CancellationToken.None);
        time.Advance(TimeSpan.FromSeconds(5));
        Assert.Empty(starts);
        paused.SetResult();
        using HttpResponseMessage firstResponse = await first.WaitAsync(TimeSpan.FromSeconds(2));
        _ = Assert.Single(starts);
        Assert.False(second.IsCompleted);
        time.Advance(TimeSpan.FromSeconds(1));
        using HttpResponseMessage secondResponse = await second.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.Equal(TimeSpan.FromSeconds(1), time.GetElapsedTime(starts[0], starts[1]));
    }

    [Fact]
    public async Task Defer_holds_dispatch_until_the_longest_monotonic_delay()
    {
        var time = new FakeTimeProvider();
        using MusicBrainzRequestGate gate = CreateGate(time);
        using HttpResponseMessage first = await gate.SendAsync(ResponseAsync, CancellationToken.None);
        gate.Defer(TimeSpan.FromSeconds(3));
        gate.Defer(TimeSpan.FromSeconds(1));
        gate.Defer(TimeSpan.FromSeconds(-1));
        Task<HttpResponseMessage> next = gate.SendAsync(ResponseAsync, CancellationToken.None);
        time.Advance(TimeSpan.FromSeconds(2));
        Assert.False(next.IsCompleted);
        time.Advance(TimeSpan.FromSeconds(1));
        using HttpResponseMessage response = await next.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Cancelled_waiters_do_not_advance_the_dispatch_schedule()
    {
        var time = new FakeTimeProvider();
        using MusicBrainzRequestGate gate = CreateGate(time);
        using HttpResponseMessage first = await gate.SendAsync(ResponseAsync, CancellationToken.None);
        using var cancellation = new CancellationTokenSource();
        Task<HttpResponseMessage> cancelled = gate.SendAsync(_ => throw new InvalidOperationException("Cancelled waiter dispatched"), cancellation.Token);
        cancellation.Cancel();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => cancelled);
        Task<HttpResponseMessage> next = gate.SendAsync(ResponseAsync, CancellationToken.None);
        time.Advance(TimeSpan.FromSeconds(1));
        using HttpResponseMessage response = await next.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Cancelled_inflight_sends_still_reserve_a_cooldown()
    {
        var time = new FakeTimeProvider();
        using MusicBrainzRequestGate gate = CreateGate(time);
        using var cancellation = new CancellationTokenSource();
        Task<HttpResponseMessage> cancelled = gate.SendAsync(async token =>
        {
            await Task.Delay(Timeout.InfiniteTimeSpan, token);
            return await ResponseAsync(token);
        }, cancellation.Token);
        cancellation.Cancel();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => cancelled);
        Task<HttpResponseMessage> next = gate.SendAsync(ResponseAsync, CancellationToken.None);
        Assert.False(next.IsCompleted);
        time.Advance(TimeSpan.FromSeconds(1));
        using HttpResponseMessage response = await next.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Failed_sends_still_reserve_a_cooldown()
    {
        var time = new FakeTimeProvider();
        using MusicBrainzRequestGate gate = CreateGate(time);
        _ = await Assert.ThrowsAsync<HttpRequestException>(() => gate.SendAsync(_ => throw new HttpRequestException(), CancellationToken.None));
        Task<HttpResponseMessage> next = gate.SendAsync(ResponseAsync, CancellationToken.None);
        Assert.False(next.IsCompleted);
        time.Advance(TimeSpan.FromSeconds(1));
        using HttpResponseMessage response = await next.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Wall_clock_jumps_neither_bypass_nor_extend_the_cooldown()
    {
        var time = new JumpingUtcClock();
        using MusicBrainzRequestGate gate = CreateGate(time);
        using HttpResponseMessage first = await gate.SendAsync(ResponseAsync, CancellationToken.None);
        time.UtcOffset = TimeSpan.FromDays(1);
        Task<HttpResponseMessage> next = gate.SendAsync(ResponseAsync, CancellationToken.None);
        Assert.False(next.IsCompleted);
        time.Advance(TimeSpan.FromSeconds(1));
        using HttpResponseMessage second = await next.WaitAsync(TimeSpan.FromSeconds(2));
        time.UtcOffset = TimeSpan.FromDays(-1);
        gate.Defer(TimeSpan.FromSeconds(2));
        Task<HttpResponseMessage> third = gate.SendAsync(ResponseAsync, CancellationToken.None);
        time.Advance(TimeSpan.FromSeconds(1));
        Assert.False(third.IsCompleted);
        time.Advance(TimeSpan.FromSeconds(1));
        using HttpResponseMessage thirdResponse = await third.WaitAsync(TimeSpan.FromSeconds(2));
        Assert.Equal(HttpStatusCode.OK, thirdResponse.StatusCode);
    }

    private static MusicBrainzRequestGate CreateGate(TimeProvider time)
    {
        return new MusicBrainzRequestGate(Options.Create(new MusicBrainzOptions { MinimumRequestIntervalMilliseconds = 1000 }), time);
    }

    private static Task<HttpResponseMessage> ResponseAsync(CancellationToken token)
    {
        token.ThrowIfCancellationRequested();
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
    }

    private sealed class JumpingUtcClock : TimeProvider
    {
        private readonly FakeTimeProvider _clock = new();
        public TimeSpan UtcOffset { get; set; }
        public override long TimestampFrequency => _clock.TimestampFrequency;
        public override long GetTimestamp()
        {
            return _clock.GetTimestamp();
        }
        public override DateTimeOffset GetUtcNow()
        {
            return _clock.GetUtcNow() + UtcOffset;
        }
        public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
        {
            return _clock.CreateTimer(callback, state, dueTime, period);
        }
        public void Advance(TimeSpan amount)
        {
            _clock.Advance(amount);
        }
    }
}
