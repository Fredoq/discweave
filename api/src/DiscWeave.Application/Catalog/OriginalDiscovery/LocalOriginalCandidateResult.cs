using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record LocalOriginalCandidateResult
{
    public required LocalOriginalCandidateStatus Status { get; init; }
    public required TrackId SourceTrackId { get; init; }
    public LocalOriginalSourceFacts? Source { get; init; }
    public required IReadOnlyList<LocalOriginalCandidate> Candidates { get; init; }

    public bool HasReliableCandidate =>
        Candidates.Count(candidate =>
            candidate.Ranked.Confidence == OriginalCandidateConfidence.High) == 1;
}
