namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchSummaryResponse
{
    public required int Open { get; init; }
    public required int Dismissed { get; init; }
    public required int Resolved { get; init; }
    public required int Reopened { get; init; }
    public required int Active { get; init; }
}
