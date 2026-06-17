namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchNavigationTarget
{
    public required string Kind { get; init; }
    public required Guid Id { get; init; }
    public required string Path { get; init; }
}
