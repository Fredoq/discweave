namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed class DiscogsOriginalDiscoveryRequestBudget
{
    private readonly Lock _gate = new();
    private readonly int _maxRequests;
    private int _usedRequestCount;

    private DiscogsOriginalDiscoveryRequestBudget(int maxRequests)
    {
        _maxRequests = maxRequests;
    }

    public int UsedRequestCount
    {
        get
        {
            lock (_gate)
            {
                return _usedRequestCount;
            }
        }
    }

    public static DiscogsOriginalDiscoveryRequestBudget Create(int maxRequests)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxRequests);
        return new DiscogsOriginalDiscoveryRequestBudget(maxRequests);
    }

    public DiscogsOriginalRouteRequestBudget CreateRouteBudget(
        int maxRouteRequests)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(maxRouteRequests);
        return new DiscogsOriginalRouteRequestBudget(
            this,
            maxRouteRequests);
    }

    internal DiscogsOriginalRequestBudgetDecision TryAcquire(
        DiscogsOriginalRouteRequestBudget routeBudget)
    {
        lock (_gate)
        {
            if (_usedRequestCount >= _maxRequests)
            {
                return DiscogsOriginalRequestBudgetDecision.DiscoveryExhausted;
            }

            if (routeBudget.UsedRequestCountUnsafe >= routeBudget.MaxRequests)
            {
                return DiscogsOriginalRequestBudgetDecision.RouteExhausted;
            }

            checked
            {
                _usedRequestCount++;
                routeBudget.IncrementUnsafe();
            }

            return DiscogsOriginalRequestBudgetDecision.Allowed;
        }
    }

    internal int ReadRouteCount(DiscogsOriginalRouteRequestBudget routeBudget)
    {
        lock (_gate)
        {
            return routeBudget.UsedRequestCountUnsafe;
        }
    }
}
