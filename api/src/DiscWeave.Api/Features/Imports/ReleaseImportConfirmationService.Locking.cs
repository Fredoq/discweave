using System.Collections.Concurrent;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static readonly ConcurrentDictionary<ConfirmationLockKey, ConfirmationLockHolder> ConfirmationLocks = [];
    private static readonly Lock ConfirmationLocksGate = new();

    internal static async Task<IAsyncDisposable> AcquireDraftMutationLockAsync(
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        CancellationToken cancellationToken)
    {
        var lockKey = new ConfirmationLockKey(collectionId, sessionId, draftId);
        ConfirmationLockHolder confirmationLock = await AcquireConfirmationLockAsync(lockKey, cancellationToken);

        return new ConfirmationLockLease(lockKey, confirmationLock);
    }

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

    private sealed class ConfirmationLockLease : IAsyncDisposable
    {
        private readonly ConfirmationLockKey _lockKey;
        private readonly ConfirmationLockHolder _confirmationLock;
        private bool _disposed;

        public ConfirmationLockLease(ConfirmationLockKey lockKey, ConfirmationLockHolder confirmationLock)
        {
            _lockKey = lockKey;
            _confirmationLock = confirmationLock;
        }

        public ValueTask DisposeAsync()
        {
            if (!_disposed)
            {
                _disposed = true;
                ReleaseConfirmationLock(_lockKey, _confirmationLock);
            }

            return ValueTask.CompletedTask;
        }
    }
}
