using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed class MusicBrainzRequestGateTests
{
    [Fact]
    public async Task WaitAsync_allows_the_first_request_without_advancing_time()
    {
        FakeTimeProvider time = new();
        MusicBrainzRequestGate gate = CreateGate(time);
        DateTimeOffset initial = time.GetUtcNow();

        await gate.WaitAsync(CancellationToken.None);

        Assert.Equal(initial, time.GetUtcNow());
    }

    [Fact]
    public async Task WaitAsync_serializes_starts_at_the_configured_interval()
    {
        FakeTimeProvider time = new();
        MusicBrainzRequestGate gate = CreateGate(time);
        DateTimeOffset initial = time.GetUtcNow();
        List<DateTimeOffset> starts = [];

        await gate.WaitAsync(CancellationToken.None);
        starts.Add(time.GetUtcNow());
        Task second = RecordStartAsync(gate, time, starts);
        Task third = RecordStartAsync(gate, time, starts);

        Assert.False(second.IsCompleted);
        Assert.False(third.IsCompleted);

        time.Advance(TimeSpan.FromSeconds(1));
        await second;
        time.Advance(TimeSpan.FromSeconds(1));
        await third;

        Assert.Equal(
            [initial, initial.AddSeconds(1), initial.AddSeconds(2)],
            starts.Order());
    }

    [Fact]
    public async Task Defer_holds_the_next_start_until_the_accepted_delay()
    {
        FakeTimeProvider time = new();
        MusicBrainzRequestGate gate = CreateGate(time);
        DateTimeOffset initial = time.GetUtcNow();
        await gate.WaitAsync(CancellationToken.None);
        gate.Defer(TimeSpan.FromSeconds(3));

        Task waiting = gate.WaitAsync(CancellationToken.None).AsTask();
        time.Advance(TimeSpan.FromSeconds(2));
        Assert.False(waiting.IsCompleted);

        time.Advance(TimeSpan.FromSeconds(1));
        await waiting;
        Assert.Equal(initial.AddSeconds(3), time.GetUtcNow());
    }

    [Fact]
    public async Task Cancelled_waiter_does_not_advance_the_gate_schedule()
    {
        FakeTimeProvider time = new();
        MusicBrainzRequestGate gate = CreateGate(time);
        DateTimeOffset initial = time.GetUtcNow();
        await gate.WaitAsync(CancellationToken.None);
        using CancellationTokenSource cancellation = new();

        Task cancelled = gate.WaitAsync(cancellation.Token).AsTask();
        cancellation.Cancel();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => cancelled);

        Task next = gate.WaitAsync(CancellationToken.None).AsTask();
        time.Advance(TimeSpan.FromSeconds(1));
        await next;
        Assert.Equal(initial.AddSeconds(1), time.GetUtcNow());
    }

    private static MusicBrainzRequestGate CreateGate(FakeTimeProvider time)
    {
        return new MusicBrainzRequestGate(
            Options.Create(new MusicBrainzOptions { MinimumRequestIntervalMilliseconds = 1000 }),
            time);
    }

    private static async Task RecordStartAsync(
        MusicBrainzRequestGate gate,
        TimeProvider time,
        List<DateTimeOffset> starts)
    {
        await gate.WaitAsync(CancellationToken.None);
        starts.Add(time.GetUtcNow());
    }
}
