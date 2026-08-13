namespace DiscWeave.Api.Features.Tracks;

public sealed record ExternalOriginalCandidateProviderStatusResponse
{
    public required string ProviderCode { get; init; }
    public required string Outcome { get; init; }
    public string? ErrorCode { get; init; }
    public TimeSpan? RetryAfter { get; init; }
}
