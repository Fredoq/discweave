namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalReleaseRouteMatchResult
{
    public required ExternalReleaseRouteMatchOutcome Outcome { get; init; }
    public required IReadOnlyList<DiscogsReleaseRouteBinding> CompatibleRows { get; init; }
    public required IReadOnlyList<string> EvidenceCodes { get; init; }
    public required IReadOnlyList<string> ContradictionCodes { get; init; }
}
