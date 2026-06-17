namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchItemResponse
{
    public required string StableKey { get; init; }
    public required string Category { get; init; }
    public required string Subtype { get; init; }
    public required string Title { get; init; }
    public required string State { get; init; }
    public required string Reason { get; init; }
    public required string SourceDetector { get; init; }
    public required IReadOnlyList<ReviewWorkbenchSignalTarget> Targets { get; init; }
    public DateTimeOffset? LastSeenAt { get; init; }
    public DateTimeOffset? UpdatedAt { get; init; }
    public ReviewWorkbenchNavigationTarget? NavigationTarget { get; init; }
}
