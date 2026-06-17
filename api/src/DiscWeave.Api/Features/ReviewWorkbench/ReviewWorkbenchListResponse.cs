namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchListResponse
{
    public required IReadOnlyList<ReviewWorkbenchItemResponse> Items { get; init; }
    public required int Limit { get; init; }
    public required int Offset { get; init; }
    public required int Total { get; init; }
    public required ReviewWorkbenchSummaryResponse Summary { get; init; }
}
