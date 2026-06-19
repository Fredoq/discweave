namespace DiscWeave.Domain.Review;

public sealed record CollectionReviewIssueSnapshot
{
    public required string StableKey { get; init; }
    public required string Category { get; init; }
    public required string Subtype { get; init; }
    public required string Title { get; init; }
    public required string SourceDetector { get; init; }
    public required string TargetsJson { get; init; }
}
