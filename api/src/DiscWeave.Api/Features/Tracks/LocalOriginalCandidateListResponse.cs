namespace DiscWeave.Api.Features.Tracks;

public sealed record LocalOriginalCandidateListResponse
{
    public required Guid SourceTrackId { get; init; }
    public required bool HasReliableLocalCandidate { get; init; }
    public required IReadOnlyList<LocalOriginalCandidateResponse> Items { get; init; }
}
