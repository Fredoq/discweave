namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record RankedOriginalCandidate
{
    public required string CandidateKey { get; init; }
    public required OriginalCandidateConfidence Confidence { get; init; }
    public required bool Selectable { get; init; }
    public OriginalCandidateRole CandidateRole { get; init; } = OriginalCandidateRole.Diagnostic;
    public OriginalCandidateChronology? CandidateChronology { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidence> SupportingEvidence { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidence> Contradictions { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidence> MissingEvidence { get; init; }
}
