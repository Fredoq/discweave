namespace DiscWeave.Api.Features.Tracks;

public sealed record ExternalOriginalCandidateResponse
{
    public required string CandidateKey { get; init; }
    public Guid? LocalTrackId { get; init; }
    public required ExternalOriginalCandidateSourceResponse? RecordingSource { get; init; }
    public required string Title { get; init; }
    public required IReadOnlyList<string> Artists { get; init; }
    public required IReadOnlyList<string> Origins { get; init; }
    public required string Confidence { get; init; }
    public required bool Selectable { get; init; }
    public required bool InferenceComplete { get; init; }
    public required string CandidateRole { get; init; }
    public required IReadOnlyList<string> DiscoveryPaths { get; init; }
    public string? SuggestedRelationTypeCode { get; init; }
    public OriginalCandidateDateResponse? EarliestKnownDate { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidenceResponse> SupportingEvidence { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidenceResponse> Contradictions { get; init; }
    public required IReadOnlyList<OriginalCandidateEvidenceResponse> MissingEvidence { get; init; }
    public required IReadOnlyList<ExternalOriginalCandidateReleaseRouteResponse> ReleaseRoutes { get; init; }
    public required ExternalOriginalCandidateProviderStatusResponse DiscogsStatus { get; init; }
    public required IReadOnlyList<string> DiscogsWarnings { get; init; }
    public required DiscogsOriginalRouteRetryRequest.ContextData? DiscogsRetryContext { get; init; }
}
