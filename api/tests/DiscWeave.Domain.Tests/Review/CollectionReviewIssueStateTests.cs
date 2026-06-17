using DiscWeave.Domain.Review;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Review;

public sealed class CollectionReviewIssueStateTests
{
    [Fact(DisplayName = "Collection review issue state applies user triage transitions")]
    public void Collection_review_issue_state_applies_user_triage_transitions()
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        CollectionReviewIssueState state = CreateState(now);

        state.Dismiss(now.AddMinutes(1), "Not relevant");
        Assert.Equal(CollectionReviewIssueStatus.Dismissed, state.Status);
        Assert.Equal(CollectionReviewIssueReason.DismissedByUser, state.Reason);
        Assert.Equal(default, state.ResolvedAt);
        Assert.Equal("Not relevant", state.Note);

        state.ResolveByUser(now.AddMinutes(2), string.Empty);
        Assert.Equal(CollectionReviewIssueStatus.Resolved, state.Status);
        Assert.Equal(CollectionReviewIssueReason.ResolvedByUser, state.Reason);
        Assert.NotEqual(default, state.ResolvedAt);

        state.Reopen(now.AddMinutes(3), "Review again");
        Assert.Equal(CollectionReviewIssueStatus.Reopened, state.Status);
        Assert.Equal(CollectionReviewIssueReason.ReopenedByUser, state.Reason);
        Assert.Equal(default, state.ResolvedAt);
        Assert.Equal("Review again", state.Note);
    }

    [Fact(DisplayName = "Collection review issue state system resolves missing generated signals")]
    public void Collection_review_issue_state_system_resolves_missing_generated_signals()
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        CollectionReviewIssueState state = CreateState(now);

        state.ResolveBySystem(now.AddMinutes(1));

        Assert.Equal(CollectionReviewIssueStatus.Resolved, state.Status);
        Assert.Equal(CollectionReviewIssueReason.ResolvedBySystem, state.Reason);
        Assert.NotEqual(default, state.ResolvedAt);
    }

    [Fact(DisplayName = "Collection review issue state reopens system resolved item when signal returns")]
    public void Collection_review_issue_state_reopens_system_resolved_item_when_signal_returns()
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        CollectionReviewIssueState state = CreateState(now);
        state.ResolveBySystem(now.AddMinutes(1));

        state.ApplySignal(Snapshot(), now.AddMinutes(2));

        Assert.Equal(CollectionReviewIssueStatus.Open, state.Status);
        Assert.Equal(CollectionReviewIssueReason.Detected, state.Reason);
        Assert.Equal(default, state.ResolvedAt);
    }

    [Theory(DisplayName = "Collection review issue state validates stable key")]
    [InlineData("")]
    [InlineData("ABCDEF")]
    [InlineData("not-a-sha256-key")]
    public void Collection_review_issue_state_validates_stable_key(string stableKey)
    {
        CollectionReviewIssueSnapshot snapshot = Snapshot() with { StableKey = stableKey };

        DomainException exception = Assert.Throws<DomainException>(() => CollectionReviewIssueState.Create(
            CollectionId.New(),
            CollectionReviewIssueStateId.New(),
            snapshot,
            DateTimeOffset.UtcNow));

        Assert.StartsWith("collection_review_issue.", exception.Code, StringComparison.Ordinal);
    }

    private static CollectionReviewIssueState CreateState(DateTimeOffset now)
    {
        return CollectionReviewIssueState.Create(
            CollectionId.New(),
            CollectionReviewIssueStateId.New(),
            Snapshot(),
            now);
    }

    private static CollectionReviewIssueSnapshot Snapshot()
    {
        return new CollectionReviewIssueSnapshot
        {
            StableKey = new string('a', 64),
            Category = "missingMetadata",
            Subtype = "tracksMissingDuration",
            Title = "Track missing duration: Ceremony",
            SourceDetector = "catalogQuality",
            TargetsJson = "[]"
        };
    }
}
