using DiscWeave.Api.Http;
using DiscWeave.Domain.Review;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchEndpointRouteBuilderExtensions
{
    private const string ActiveStateName = "active";
    private const string OpenStateName = "open";
    private const string DismissedStateName = "dismissed";
    private const string ResolvedStateName = "resolved";
    private const string ReopenedStateName = "reopened";

    private static bool TryParseStateFilter(string? state, out ReviewWorkbenchStateFilter filter, out IResult error)
    {
        filter = ReviewWorkbenchStateFilter.Active;
        error = Results.Empty;

        if (string.IsNullOrWhiteSpace(state) || string.Equals(state, ActiveStateName, StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (Enum.TryParse(state, ignoreCase: true, out CollectionReviewIssueStatus parsed) && Enum.IsDefined(parsed))
        {
            filter = parsed switch
            {
                CollectionReviewIssueStatus.Open => ReviewWorkbenchStateFilter.Open,
                CollectionReviewIssueStatus.Dismissed => ReviewWorkbenchStateFilter.Dismissed,
                CollectionReviewIssueStatus.Resolved => ReviewWorkbenchStateFilter.Resolved,
                CollectionReviewIssueStatus.Reopened => ReviewWorkbenchStateFilter.Reopened,
                _ => ReviewWorkbenchStateFilter.Active
            };
            return true;
        }

        error = EndpointErrors.BadRequest("review_workbench.state_invalid", "Review Workbench state is invalid");
        return false;
    }

    private static bool TryParseUpdateState(string? state, out ReviewWorkbenchUpdateState updateState, out IResult error)
    {
        updateState = ReviewWorkbenchUpdateState.Dismissed;
        error = Results.Empty;

        if (string.Equals(state, DismissedStateName, StringComparison.OrdinalIgnoreCase))
        {
            updateState = ReviewWorkbenchUpdateState.Dismissed;
            return true;
        }

        if (string.Equals(state, ResolvedStateName, StringComparison.OrdinalIgnoreCase))
        {
            updateState = ReviewWorkbenchUpdateState.Resolved;
            return true;
        }

        if (string.Equals(state, ReopenedStateName, StringComparison.OrdinalIgnoreCase))
        {
            updateState = ReviewWorkbenchUpdateState.Reopened;
            return true;
        }

        error = EndpointErrors.BadRequest("review_workbench.state_invalid", "Review Workbench state is invalid");
        return false;
    }

    private static bool MatchesStateFilter(string state, ReviewWorkbenchStateFilter filter)
    {
        return filter switch
        {
            ReviewWorkbenchStateFilter.Active => state is OpenStateName or ReopenedStateName,
            ReviewWorkbenchStateFilter.Open => state == OpenStateName,
            ReviewWorkbenchStateFilter.Dismissed => state == DismissedStateName,
            ReviewWorkbenchStateFilter.Resolved => state == ResolvedStateName,
            ReviewWorkbenchStateFilter.Reopened => state == ReopenedStateName,
            _ => false
        };
    }

    private static string StateName(CollectionReviewIssueStatus status)
    {
        return status switch
        {
            CollectionReviewIssueStatus.Open => OpenStateName,
            CollectionReviewIssueStatus.Dismissed => DismissedStateName,
            CollectionReviewIssueStatus.Resolved => ResolvedStateName,
            CollectionReviewIssueStatus.Reopened => ReopenedStateName,
            _ => throw new InvalidOperationException("Unsupported Review Workbench state")
        };
    }

    private static string ReasonName(CollectionReviewIssueReason reason)
    {
        return reason switch
        {
            CollectionReviewIssueReason.Detected => "detected",
            CollectionReviewIssueReason.DismissedByUser => "dismissedByUser",
            CollectionReviewIssueReason.ResolvedByUser => "resolvedByUser",
            CollectionReviewIssueReason.ResolvedBySystem => "resolvedBySystem",
            CollectionReviewIssueReason.ReopenedByUser => "reopenedByUser",
            _ => throw new InvalidOperationException("Unsupported Review Workbench reason")
        };
    }

    private enum ReviewWorkbenchStateFilter
    {
        Active,
        Open,
        Dismissed,
        Resolved,
        Reopened
    }

    private enum ReviewWorkbenchUpdateState
    {
        Dismissed,
        Resolved,
        Reopened
    }
}
