using System.Collections.Concurrent;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static readonly ConcurrentDictionary<ConfirmationLockKey, ConfirmationLockHolder> ConfirmationLocks = [];
    private static readonly Lock ConfirmationLocksGate = new();

    private static async Task<ConfirmationLockHolder> AcquireConfirmationLockAsync(
        ConfirmationLockKey lockKey,
        CancellationToken cancellationToken)
    {
        ConfirmationLockHolder confirmationLock;
        lock (ConfirmationLocksGate)
        {
            confirmationLock = ConfirmationLocks.GetOrAdd(lockKey, _ => new ConfirmationLockHolder());
            confirmationLock.RefCount++;
        }

        try
        {
            await confirmationLock.Semaphore.WaitAsync(cancellationToken);
            return confirmationLock;
        }
        catch
        {
            ReleaseConfirmationLockReservation(lockKey, confirmationLock);
            throw;
        }
    }

    private static void ReleaseConfirmationLock(
        ConfirmationLockKey lockKey,
        ConfirmationLockHolder confirmationLock)
    {
        _ = confirmationLock.Semaphore.Release();
        ReleaseConfirmationLockReservation(lockKey, confirmationLock);
    }

    private static void ReleaseConfirmationLockReservation(
        ConfirmationLockKey lockKey,
        ConfirmationLockHolder confirmationLock)
    {
        bool shouldDispose = false;
        lock (ConfirmationLocksGate)
        {
            confirmationLock.RefCount--;
            if (confirmationLock.RefCount == 0 &&
                ConfirmationLocks.TryRemove(lockKey, out ConfirmationLockHolder? removed))
            {
                shouldDispose = ReferenceEquals(removed, confirmationLock);
            }
        }

        if (shouldDispose)
        {
            confirmationLock.Semaphore.Dispose();
        }
    }

    private sealed class ConfirmationLockHolder
    {
        public SemaphoreSlim Semaphore { get; } = new(1, 1);

        public int RefCount { get; set; }
    }
}
