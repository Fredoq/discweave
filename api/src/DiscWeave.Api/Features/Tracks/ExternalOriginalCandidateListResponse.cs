namespace DiscWeave.Api.Features.Tracks;

public sealed record ExternalOriginalCandidateListResponse
{
    public required LocalOriginalCandidateListResponse Local { get; init; }
    public required IReadOnlyList<ExternalOriginalCandidateResponse> Items { get; init; }
    public required IReadOnlyList<ExternalOriginalCandidateProviderStatusResponse> ProviderStatuses { get; init; }
    public required IReadOnlyList<string> Warnings { get; init; }
}
