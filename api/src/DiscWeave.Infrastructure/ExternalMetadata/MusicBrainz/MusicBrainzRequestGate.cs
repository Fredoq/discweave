using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed class MusicBrainzRequestGate : IMusicBrainzRequestGate, IDisposable
{
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private readonly Lock _stateLock = new();
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _minimumInterval;
    private readonly long _origin;
    private TimeSpan _nextStartAfter;

    public MusicBrainzRequestGate(IOptions<MusicBrainzOptions> options, TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(timeProvider);
        if (options.Value.MinimumRequestIntervalMilliseconds < 1000)
        {
            throw new ArgumentOutOfRangeException(nameof(options));
        }

        _timeProvider = timeProvider;
        _origin = timeProvider.GetTimestamp();
        _minimumInterval = TimeSpan.FromMilliseconds(options.Value.MinimumRequestIntervalMilliseconds);
    }

    public async Task<HttpResponseMessage> SendAsync(
        Func<CancellationToken, Task<HttpResponseMessage>> send, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(send);
        await _semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
        bool started = false;
        try
        {
            await WaitUntilEligibleAsync(cancellationToken).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            started = true;
            return await send(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            if (started)
            {
                // Keep ownership through response headers (or failure), then cool down.
                // This deliberately trades parallel request latency for an actual-send guarantee.
                Defer(_minimumInterval);
            }
            _ = _semaphore.Release();
        }
    }

    private async Task WaitUntilEligibleAsync(CancellationToken cancellationToken)
    {
        while (true)
        {
            TimeSpan remaining;
            lock (_stateLock)
            {
                remaining = _nextStartAfter - Elapsed();
            }
            if (remaining <= TimeSpan.Zero)
            {
                return;
            }
            await Task.Delay(remaining, _timeProvider, cancellationToken).ConfigureAwait(false);
        }
    }

    public void Defer(TimeSpan retryAfter)
    {
        if (retryAfter < TimeSpan.Zero)
        {
            return;
        }
        lock (_stateLock)
        {
            TimeSpan deferredStart = Elapsed() + retryAfter;
            if (deferredStart > _nextStartAfter)
            {
                _nextStartAfter = deferredStart;
            }
        }
    }

    private TimeSpan Elapsed()
    {
        return _timeProvider.GetElapsedTime(_origin, _timeProvider.GetTimestamp());
    }

    public void Dispose()
    {
        _semaphore.Dispose();
    }
}
