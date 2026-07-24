namespace DiscWeave.Api.Features.Tracks;

public sealed record OriginalCandidateEvidenceResponse
{
    public required string Code { get; init; }
    public required string Channel { get; init; }
}
