namespace DiscWeave.Api.Features.Tracks;

public sealed record LocalOriginalCandidateResponse
{
    public required string CandidateKey { get; init; }
    public required Guid LocalTrackId { get; init; }
    public required string Title { get; init; }
    public required string ArtistDisplay { get; init; }
    public int? DurationSeconds { get; init; }
    public int? VersionYear { get; init; }
    public required IReadOnlyList<string> Origins { get; init; }
    public required string Confidence { get; init; }
    public required bool Selectable { get; init; }
    public required bool IsExistingRoot { get; init; }
    public required int MemberCount { get; init; }
    public required bool RequiresPromotion { get; init; }
    public string? SuggestedRelationTypeCode { get; init; }
    public OriginalCandidateDateResponse? EarliestKnownDate { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidenceResponse> SupportingEvidence { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidenceResponse> Contradictions { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidenceResponse> MissingEvidence { get; init; }
}
