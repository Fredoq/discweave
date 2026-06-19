namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchRefreshResponse
{
    public required int GeneratedSignals { get; init; }
    public required int Created { get; init; }
    public required int Updated { get; init; }
    public required int SystemResolved { get; init; }
    public required ReviewWorkbenchSummaryResponse Summary { get; init; }
}
