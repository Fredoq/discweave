namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchStateUpdateRequest
{
    public required string State { get; init; }
    public string? Note { get; init; }
}
