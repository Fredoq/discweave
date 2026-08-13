namespace DiscWeave.Api.Features.Tracks;

public sealed record ExternalOriginalCandidatePartialDateResponse
{
    public required int Year { get; init; }
    public int? Month { get; init; }
    public int? Day { get; init; }
}
