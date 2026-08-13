namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record OriginalCandidateEvidence
{
    public required OriginalCandidateEvidenceCode Code { get; init; }
    public required OriginalCandidateEvidenceKind Kind { get; init; }
    public required OriginalCandidateEvidenceChannel Channel { get; init; }
}
