namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

internal sealed class MusicBrainzOperationContext : IDisposable
{
    private readonly CancellationTokenSource _deadline;
    private readonly int _maximumAttempts;
    private int _attempts;

    public MusicBrainzOperationContext(
        int operationTimeoutSeconds,
        int maximumAttempts,
        TimeProvider timeProvider)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(operationTimeoutSeconds, 1);
        ArgumentOutOfRangeException.ThrowIfLessThan(maximumAttempts, 1);
        ArgumentNullException.ThrowIfNull(timeProvider);

        _deadline = new CancellationTokenSource(
            TimeSpan.FromSeconds(operationTimeoutSeconds),
            timeProvider);
        _maximumAttempts = maximumAttempts;
    }

    public CancellationToken DeadlineToken => _deadline.Token;

    public bool TryReserveAttempt()
    {
        int attempt = Interlocked.Increment(ref _attempts);
        if (attempt <= _maximumAttempts)
        {
            return true;
        }

        _ = Interlocked.Decrement(ref _attempts);
        return false;
    }

    public void Dispose()
    {
        _deadline.Dispose();
    }
}
