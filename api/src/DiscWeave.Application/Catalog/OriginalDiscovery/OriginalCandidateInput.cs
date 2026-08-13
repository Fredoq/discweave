namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record OriginalCandidateInput
{
    public required string CandidateKey { get; init; }
    public OriginalCandidateChronology? CandidateChronology { get; init; }
    public required IReadOnlyCollection<OriginalCandidateEvidence> Evidence { get; init; }
    public required IReadOnlySet<OriginalCandidateHardGate> HardGates { get; init; }
    public OriginalCandidateRole CandidateRole { get; init; } = OriginalCandidateRole.Diagnostic;
}
