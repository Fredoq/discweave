namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchSignalTarget
{
    public required string Kind { get; init; }
    public required Guid Id { get; init; }
    public required string Title { get; init; }
    public string? Subtitle { get; init; }
    public string? CatalogTargetKind { get; init; }
    public ReviewWorkbenchNavigationTarget? NavigationTarget { get; init; }
}
