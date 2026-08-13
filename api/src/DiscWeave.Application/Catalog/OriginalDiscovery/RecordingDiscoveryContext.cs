namespace DiscWeave.Application.Catalog.OriginalDiscovery;

/// <summary>
/// Describes how an external recording was discovered and which evidence was
/// available before it was passed to the common candidate ranker.
/// </summary>
public sealed record RecordingDiscoveryContext
{
    public required OriginalCandidateRole Role { get; init; }
    public required IReadOnlySet<OriginalDiscoveryPath> Paths { get; init; }
    public required IReadOnlyCollection<OriginalCandidateEvidence> Evidence { get; init; }
    public required bool StructuralEvidenceComplete { get; init; }
}
