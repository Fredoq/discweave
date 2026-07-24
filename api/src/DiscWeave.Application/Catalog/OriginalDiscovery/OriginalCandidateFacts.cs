namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record OriginalCandidateFacts
{
    public required string CandidateKey { get; init; }
    public required string SourceBaseTitle { get; init; }
    public required string CandidateBaseTitle { get; init; }
    public string? SourcePrimaryArtist { get; init; }
    public string? CandidatePrimaryArtist { get; init; }
    public TimeSpan? SourceDuration { get; init; }
    public TimeSpan? CandidateDuration { get; init; }
    public OriginalCandidateChronology? SourceChronology { get; init; }
    public OriginalCandidateChronology? CandidateChronology { get; init; }
    public required bool DirectedLineage { get; init; }
    public required bool KnownLocalRoot { get; init; }
    public required bool VersionMarker { get; init; }
    public required bool CreditsSupport { get; init; }
    public required IReadOnlySet<OriginalCandidateHardGate> HardGates { get; init; }
    public required IReadOnlyCollection<OriginalCandidateEvidence> AdditionalEvidence { get; init; }
}
