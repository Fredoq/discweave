namespace DiscWeave.Domain.Review;

public enum CollectionReviewIssueReason
{
    Detected = 0,
    DismissedByUser = 1,
    ResolvedByUser = 2,
    ResolvedBySystem = 3,
    ReopenedByUser = 4
}
