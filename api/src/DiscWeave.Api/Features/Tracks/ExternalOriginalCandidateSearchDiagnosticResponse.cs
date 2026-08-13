namespace DiscWeave.Api.Features.Tracks;

public sealed record ExternalOriginalCandidateSearchDiagnosticResponse
{
    public required string ProviderCode { get; init; }
    public required string RequestUrl { get; init; }
    public int? TotalResults { get; init; }
    public required int Offset { get; init; }
    public required IReadOnlyList<ExternalOriginalCandidateSearchDiagnosticItemResponse> Items { get; init; }
}

public sealed record ExternalOriginalCandidateSearchDiagnosticItemResponse
{
    public required string ExternalId { get; init; }
    public required string Title { get; init; }
    public required IReadOnlyList<string> Artists { get; init; }
    public double? DurationSeconds { get; init; }
    public int? Score { get; init; }
}
