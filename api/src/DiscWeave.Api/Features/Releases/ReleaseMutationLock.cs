using System.Collections.Concurrent;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Releases;

internal static class ReleaseMutationLock
{
    private static readonly ConcurrentDictionary<(CollectionId CollectionId, Guid ReleaseId), MutationLockHolder> MutationLocks = [];
    private static readonly Lock MutationLocksGate = new();

    internal static async Task<IAsyncDisposable> AcquireAsync(
        CollectionId collectionId,
        Guid releaseId,
        CancellationToken cancellationToken)
    {
        (CollectionId CollectionId, Guid ReleaseId) lockKey = (collectionId, releaseId);
        MutationLockHolder mutationLock = await AcquireMutationLockAsync(lockKey, cancellationToken);

        return new MutationLockLease(lockKey, mutationLock);
    }

    private static async Task<MutationLockHolder> AcquireMutationLockAsync(
        (CollectionId CollectionId, Guid ReleaseId) lockKey,
        CancellationToken cancellationToken)
    {
        MutationLockHolder mutationLock;
        lock (MutationLocksGate)
        {
            mutationLock = MutationLocks.GetOrAdd(lockKey, _ => new MutationLockHolder());
            mutationLock.RefCount++;
        }

        try
        {
            await mutationLock.Semaphore.WaitAsync(cancellationToken);
            return mutationLock;
        }
        catch
        {
            ReleaseMutationLockReservation(lockKey, mutationLock);
            throw;
        }
    }

    private static void ReleaseMutationLock(
        (CollectionId CollectionId, Guid ReleaseId) lockKey,
        MutationLockHolder mutationLock)
    {
        _ = mutationLock.Semaphore.Release();
        ReleaseMutationLockReservation(lockKey, mutationLock);
    }

    private static void ReleaseMutationLockReservation(
        (CollectionId CollectionId, Guid ReleaseId) lockKey,
        MutationLockHolder mutationLock)
    {
        bool shouldDispose = false;
        lock (MutationLocksGate)
        {
            mutationLock.RefCount--;
            if (mutationLock.RefCount == 0 &&
                MutationLocks.TryRemove(lockKey, out MutationLockHolder? removed))
            {
                shouldDispose = ReferenceEquals(removed, mutationLock);
            }
        }

        if (shouldDispose)
        {
            mutationLock.Semaphore.Dispose();
        }
    }

    private sealed class MutationLockHolder
    {
        public SemaphoreSlim Semaphore { get; } = new(1, 1);

        public int RefCount { get; set; }
    }

    private sealed class MutationLockLease : IAsyncDisposable
    {
        private readonly (CollectionId CollectionId, Guid ReleaseId) _lockKey;
        private readonly MutationLockHolder _mutationLock;
        private bool _disposed;

        public MutationLockLease((CollectionId CollectionId, Guid ReleaseId) lockKey, MutationLockHolder mutationLock)
        {
            _lockKey = lockKey;
            _mutationLock = mutationLock;
        }

        public ValueTask DisposeAsync()
        {
            if (!_disposed)
            {
                _disposed = true;
                ReleaseMutationLock(_lockKey, _mutationLock);
            }

            return ValueTask.CompletedTask;
        }
    }
}
