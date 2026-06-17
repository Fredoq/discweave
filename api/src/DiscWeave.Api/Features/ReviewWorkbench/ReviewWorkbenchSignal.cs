namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchSignal
{
    public required string StableKey { get; init; }
    public required string Category { get; init; }
    public required string Subtype { get; init; }
    public required string Title { get; init; }
    public required string SourceDetector { get; init; }
    public required IReadOnlyList<ReviewWorkbenchSignalTarget> Targets { get; init; }
    public string? ComparisonKey { get; init; }
}
