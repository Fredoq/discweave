namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed class DiscogsOriginalRouteRequestBudget
{
    private readonly DiscogsOriginalDiscoveryRequestBudget _discoveryBudget;
    internal DiscogsOriginalRouteRequestBudget(
        DiscogsOriginalDiscoveryRequestBudget discoveryBudget,
        int maxRequests)
    {
        _discoveryBudget = discoveryBudget;
        MaxRequests = maxRequests;
    }

    public int UsedRequestCount =>
        _discoveryBudget.ReadRouteCount(this);

    internal int MaxRequests { get; }

    internal int UsedRequestCountUnsafe { get; private set; }

    public DiscogsOriginalRequestBudgetDecision TryAcquireAttempt()
    {
        return _discoveryBudget.TryAcquire(this);
    }

    internal void IncrementUnsafe()
    {
        UsedRequestCountUnsafe++;
    }
}
