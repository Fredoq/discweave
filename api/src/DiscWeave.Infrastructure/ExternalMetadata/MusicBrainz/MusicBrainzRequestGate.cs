using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed class MusicBrainzRequestGate : IMusicBrainzRequestGate, IDisposable
{
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private readonly Lock _stateLock = new();
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _minimumInterval;
    private DateTimeOffset _nextStartAt = DateTimeOffset.MinValue;

    public MusicBrainzRequestGate(IOptions<MusicBrainzOptions> options, TimeProvider timeProvider)
    {
        ArgumentNullException.ThrowIfNull(options);
        ArgumentNullException.ThrowIfNull(timeProvider);

        if (options.Value.MinimumRequestIntervalMilliseconds < 0)
        {
            throw new ArgumentOutOfRangeException(nameof(options));
        }

        _timeProvider = timeProvider;
        _minimumInterval = TimeSpan.FromMilliseconds(options.Value.MinimumRequestIntervalMilliseconds);
    }

    public async ValueTask WaitAsync(CancellationToken cancellationToken)
    {
        await _semaphore.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            while (true)
            {
                DateTimeOffset now = _timeProvider.GetUtcNow();
                DateTimeOffset nextStartAt;
                lock (_stateLock)
                {
                    nextStartAt = _nextStartAt;
                    if (nextStartAt <= now)
                    {
                        _nextStartAt = now + _minimumInterval;
                        return;
                    }
                }

                await Task.Delay(nextStartAt - now, _timeProvider, cancellationToken).ConfigureAwait(false);
            }
        }
        finally
        {
            _ = _semaphore.Release();
        }
    }

    public void Defer(TimeSpan retryAfter)
    {
        if (retryAfter < TimeSpan.Zero)
        {
            return;
        }

        DateTimeOffset deferredStart = _timeProvider.GetUtcNow() + retryAfter;
        lock (_stateLock)
        {
            if (deferredStart > _nextStartAt)
            {
                _nextStartAt = deferredStart;
            }
        }
    }

    public void Dispose()
    {
        _semaphore.Dispose();
    }
}
