namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record ExternalOriginalCandidateResult
{
    public required LocalOriginalCandidateResult Local { get; init; }
    public required IReadOnlyList<ExternalOriginalCandidate> Candidates { get; init; }
    public required IReadOnlyList<ExternalProviderOperationStatus> ProviderStatuses { get; init; }
    public required IReadOnlyList<string> Warnings { get; init; }
}
