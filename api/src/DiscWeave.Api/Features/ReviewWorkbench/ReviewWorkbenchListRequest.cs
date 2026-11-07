namespace DiscWeave.Api.Features.ReviewWorkbench;

public sealed record ReviewWorkbenchListRequest
{
    public string? Focus { get; init; }
    public string? Category { get; init; }
    public string? State { get; init; }
    public string? Sort { get; init; }
    public int? Limit { get; init; }
    public int? Offset { get; init; }
}
