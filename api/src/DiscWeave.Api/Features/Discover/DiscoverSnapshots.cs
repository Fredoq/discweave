using System.Security.Cryptography;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Discover;

public sealed class DiscoverSnapshots
{
    private readonly Dictionary<string, DiscoverSnapshot> _snapshots = new(StringComparer.Ordinal);
    private readonly HashSet<CollectionId> _resolving = [];
    private readonly Lock _gate = new();
    private readonly TimeProvider _time;

    public DiscoverSnapshots(TimeProvider time)
    {
        _time = time;
    }

    public string Add(CollectionId collectionId, IReadOnlyList<DiscoverExample> examples, string mode, DiscoverContext? context = null)
    {
        lock (_gate)
        {
            DateTimeOffset now = _time.GetUtcNow();
            foreach (string key in _snapshots.Where(pair => pair.Value.ExpiresAt <= now).Select(pair => pair.Key).ToArray())
            {
                _ = _snapshots.Remove(key);
            }

            while (_snapshots.Count >= 256)
            {
                _ = _snapshots.Remove(_snapshots.Keys.First());
            }

            string token = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
            _snapshots[token] = new DiscoverSnapshot(collectionId, examples, mode, now.AddMinutes(5), context);
            return token;
        }
    }

    public bool TryBegin(CollectionId collectionId)
    {
        lock (_gate)
        {
            return _resolving.Add(collectionId);
        }
    }

    public void End(CollectionId collectionId)
    {
        lock (_gate)
        {
            _ = _resolving.Remove(collectionId);
        }
    }

    public DiscoverSnapshot? Take(string token, CollectionId collectionId)
    {
        lock (_gate)
        {
            if (!_snapshots.TryGetValue(token, out DiscoverSnapshot? snapshot) ||
                snapshot.CollectionId != collectionId || snapshot.ExpiresAt <= _time.GetUtcNow())
            {
                return null;
            }

            _ = _snapshots.Remove(token);
            return snapshot;
        }
    }
}
