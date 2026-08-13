using System.Net;
using DiscWeave.Application.ExternalMetadata;
using Microsoft.Extensions.Time.Testing;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Body_transport_failure_retries_with_exact_delays_and_ends_unavailable(
        bool useHttpIOException)
    {
        var timeProvider = new ObservedTimeProvider();
        var gate = new ImmediateRequestGate();
        var handler = new CapturingHandler((_, _) =>
        {
            Exception exception = useHttpIOException
                ? new HttpIOException(HttpRequestError.ResponseEnded, "Response body ended unexpectedly.")
                : new IOException("Response body read failed.");
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StreamContent(new ThrowingReadStream(exception))
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
        Task firstDelayScheduled = timeProvider.WaitForTimerCountAsync(2);
        Task firstPhase = await Task.WhenAny(operation, firstDelayScheduled);
        if (ReferenceEquals(firstPhase, operation))
        {
            _ = await operation;
        }

        await firstDelayScheduled;
        Assert.Equal(1, handler.CallCount);
        Assert.Equal(1, gate.WaitCount);

        timeProvider.Advance(TimeSpan.FromSeconds(1));
        await WaitUntilAsync(() => handler.CallCount == 2);
        Task secondDelayScheduled = timeProvider.WaitForTimerCountAsync(3);
        Task secondPhase = await Task.WhenAny(operation, secondDelayScheduled);
        if (ReferenceEquals(secondPhase, operation))
        {
            _ = await operation;
        }

        await secondDelayScheduled;
        Assert.Equal(2, handler.CallCount);
        Assert.Equal(2, gate.WaitCount);

        timeProvider.Advance(TimeSpan.FromSeconds(2));
        ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
            await operation.WaitAsync(TimeSpan.FromSeconds(2));

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.Unavailable, result.Error.Kind);
        Assert.Equal(3, handler.CallCount);
        Assert.Equal(3, gate.WaitCount);
    }

    private sealed class ObservedTimeProvider : TimeProvider
    {
        private readonly FakeTimeProvider _inner = new();
        private readonly Lock _sync = new();
        private readonly Dictionary<int, TaskCompletionSource> _waiters = [];
        private int _timerCount;

        public override TimeZoneInfo LocalTimeZone => _inner.LocalTimeZone;

        public override long TimestampFrequency => _inner.TimestampFrequency;

        public override DateTimeOffset GetUtcNow()
        {
            return _inner.GetUtcNow();
        }

        public override long GetTimestamp()
        {
            return _inner.GetTimestamp();
        }

        public override ITimer CreateTimer(
            TimerCallback callback,
            object? state,
            TimeSpan dueTime,
            TimeSpan period)
        {
            int timerCount = Interlocked.Increment(ref _timerCount);
            List<TaskCompletionSource> completed = [];
            lock (_sync)
            {
                foreach ((int expected, TaskCompletionSource waiter) in _waiters)
                {
                    if (expected <= timerCount)
                    {
                        completed.Add(waiter);
                    }
                }

                foreach (int expected in _waiters.Keys.Where(expected => expected <= timerCount).ToArray())
                {
                    _ = _waiters.Remove(expected);
                }
            }

            foreach (TaskCompletionSource waiter in completed)
            {
                _ = waiter.TrySetResult();
            }

            return _inner.CreateTimer(callback, state, dueTime, period);
        }

        public Task WaitForTimerCountAsync(int expected)
        {
            lock (_sync)
            {
                if (Volatile.Read(ref _timerCount) >= expected)
                {
                    return Task.CompletedTask;
                }

                var waiter = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
                _waiters.Add(expected, waiter);
                return waiter.Task;
            }
        }

        public void Advance(TimeSpan elapsed)
        {
            _inner.Advance(elapsed);
        }
    }

    private sealed class ThrowingReadStream : Stream
    {
        private readonly Exception _exception;

        public ThrowingReadStream(Exception exception)
        {
            _exception = exception;
        }

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();

        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override void Flush()
        {
        }

        public override int Read(byte[] buffer, int offset, int count)
        {
            throw _exception;
        }

        public override ValueTask<int> ReadAsync(
            Memory<byte> buffer,
            CancellationToken cancellationToken = default)
        {
            return ValueTask.FromException<int>(_exception);
        }

        public override long Seek(long offset, SeekOrigin origin)
        {
            throw new NotSupportedException();
        }

        public override void SetLength(long value)
        {
            throw new NotSupportedException();
        }

        public override void Write(byte[] buffer, int offset, int count)
        {
            throw new NotSupportedException();
        }
    }
}
