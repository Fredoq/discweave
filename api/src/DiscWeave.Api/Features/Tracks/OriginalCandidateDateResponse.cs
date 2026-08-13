namespace DiscWeave.Api.Features.Tracks;

public sealed record OriginalCandidateDateResponse
{
    public required string Value { get; init; }
    public required string Precision { get; init; }
    public required bool Complete { get; init; }
}
