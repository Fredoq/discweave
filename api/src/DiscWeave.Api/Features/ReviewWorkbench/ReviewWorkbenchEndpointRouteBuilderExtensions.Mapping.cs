using System.Text.Json;
using DiscWeave.Api.Http;
using DiscWeave.Domain.Review;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchEndpointRouteBuilderExtensions
{
    private static IEnumerable<ReviewWorkbenchItemResponse> BuildItems(
        IReadOnlyList<ReviewWorkbenchSignal> signals,
        IReadOnlyList<CollectionReviewIssueState> states)
    {
        var statesByKey = states.ToDictionary(state => state.StableKey, StringComparer.Ordinal);
        HashSet<string> emittedKeys = [];

        foreach (ReviewWorkbenchSignal signal in signals)
        {
            if (statesByKey.TryGetValue(signal.StableKey, out CollectionReviewIssueState? state))
            {
                _ = emittedKeys.Add(signal.StableKey);
                yield return ItemFromStateAndSignal(state, signal);
            }
            else
            {
                yield return ItemFromSignal(signal);
            }
        }

        foreach (CollectionReviewIssueState state in states.Where(state => !emittedKeys.Contains(state.StableKey)))
        {
            yield return ItemFromState(state);
        }
    }

    private static ReviewWorkbenchItemResponse ItemFromStateAndSignal(
        CollectionReviewIssueState state,
        ReviewWorkbenchSignal signal)
    {
        return new ReviewWorkbenchItemResponse
        {
            StableKey = state.StableKey,
            Category = state.Category,
            Subtype = state.Subtype,
            Title = state.Title,
            State = StateName(state.Status),
            Reason = ReasonName(state.Reason),
            SourceDetector = state.SourceDetector,
            Targets = signal.Targets,
            LastSeenAt = state.LastSeenAt,
            UpdatedAt = state.UpdatedAt,
            NavigationTarget = FirstNavigationTarget(signal.Targets)
        };
    }

    private static ReviewWorkbenchItemResponse ItemFromSignal(ReviewWorkbenchSignal signal)
    {
        return new ReviewWorkbenchItemResponse
        {
            StableKey = signal.StableKey,
            Category = signal.Category,
            Subtype = signal.Subtype,
            Title = signal.Title,
            State = "open",
            Reason = "detected",
            SourceDetector = signal.SourceDetector,
            Targets = signal.Targets,
            LastSeenAt = null,
            UpdatedAt = null,
            NavigationTarget = FirstNavigationTarget(signal.Targets)
        };
    }

    private static ReviewWorkbenchItemResponse ItemFromState(CollectionReviewIssueState state)
    {
        ReviewWorkbenchSignalTarget[] targets = DeserializeTargets(state.TargetsJson);

        return new ReviewWorkbenchItemResponse
        {
            StableKey = state.StableKey,
            Category = state.Category,
            Subtype = state.Subtype,
            Title = state.Title,
            State = StateName(state.Status),
            Reason = ReasonName(state.Reason),
            SourceDetector = state.SourceDetector,
            Targets = targets,
            LastSeenAt = state.LastSeenAt,
            UpdatedAt = state.UpdatedAt,
            NavigationTarget = FirstNavigationTarget(targets)
        };
    }

    private static ReviewWorkbenchNavigationTarget? FirstNavigationTarget(IReadOnlyList<ReviewWorkbenchSignalTarget> targets)
    {
        return targets.Count == 0 ? null : targets[0].NavigationTarget;
    }

    private static CollectionReviewIssueSnapshot Snapshot(ReviewWorkbenchSignal signal)
    {
        return new CollectionReviewIssueSnapshot
        {
            StableKey = signal.StableKey,
            Category = signal.Category,
            Subtype = signal.Subtype,
            Title = signal.Title,
            SourceDetector = signal.SourceDetector,
            TargetsJson = JsonSerializer.Serialize(signal.Targets, TargetsJsonOptions)
        };
    }

    private static ReviewWorkbenchSignalTarget[] DeserializeTargets(string targetsJson)
    {
        return JsonSerializer.Deserialize<ReviewWorkbenchSignalTarget[]>(targetsJson, TargetsJsonOptions) ?? [];
    }

    private static void ApplyUpdate(
        CollectionReviewIssueState state,
        ReviewWorkbenchUpdateState updateState,
        DateTimeOffset now,
        string note)
    {
        switch (updateState)
        {
            case ReviewWorkbenchUpdateState.Dismissed:
                state.Dismiss(now, note);
                break;
            case ReviewWorkbenchUpdateState.Resolved:
                state.ResolveByUser(now, note);
                break;
            case ReviewWorkbenchUpdateState.Reopened:
                state.Reopen(now, note);
                break;
            default:
                throw new InvalidOperationException("Unsupported Review Workbench state update");
        }
    }

    private static async Task<ReviewWorkbenchSummaryResponse> SummaryAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        CollectionReviewIssueState[] states = await context.CollectionReviewIssueStates
            .Where(item => item.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);

        return Summary(states.Select(ItemFromState));
    }

    private static ReviewWorkbenchSummaryResponse Summary(IEnumerable<ReviewWorkbenchItemResponse> items)
    {
        ReviewWorkbenchItemResponse[] materialized = [.. items];
        int open = materialized.Count(item => item.State == "open");
        int reopened = materialized.Count(item => item.State == "reopened");

        return new ReviewWorkbenchSummaryResponse
        {
            Open = open,
            Dismissed = materialized.Count(item => item.State == "dismissed"),
            Resolved = materialized.Count(item => item.State == "resolved"),
            Reopened = reopened,
            Active = open + reopened
        };
    }

    private static bool TryNormalizeCategory(string? category, out string? normalizedCategory, out IResult error)
    {
        normalizedCategory = null;
        error = Results.Empty;

        if (string.IsNullOrWhiteSpace(category))
        {
            return true;
        }

        string trimmed = category.Trim();
        if (!ReviewWorkbenchCategories.All.Contains(trimmed, StringComparer.Ordinal))
        {
            error = EndpointErrors.BadRequest("review_workbench.category_invalid", "Review Workbench category is invalid");
            return false;
        }

        normalizedCategory = trimmed;
        return true;
    }

    private static bool TryParseStateFilter(string? state, out ReviewWorkbenchStateFilter filter, out IResult error)
    {
        filter = ReviewWorkbenchStateFilter.Active;
        error = Results.Empty;

        if (string.IsNullOrWhiteSpace(state) || string.Equals(state, "active", StringComparison.OrdinalIgnoreCase))
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

        if (string.Equals(state, "dismissed", StringComparison.OrdinalIgnoreCase))
        {
            updateState = ReviewWorkbenchUpdateState.Dismissed;
            return true;
        }

        if (string.Equals(state, "resolved", StringComparison.OrdinalIgnoreCase))
        {
            updateState = ReviewWorkbenchUpdateState.Resolved;
            return true;
        }

        if (string.Equals(state, "reopened", StringComparison.OrdinalIgnoreCase))
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
            ReviewWorkbenchStateFilter.Active => state is "open" or "reopened",
            ReviewWorkbenchStateFilter.Open => state == "open",
            ReviewWorkbenchStateFilter.Dismissed => state == "dismissed",
            ReviewWorkbenchStateFilter.Resolved => state == "resolved",
            ReviewWorkbenchStateFilter.Reopened => state == "reopened",
            _ => false
        };
    }

    private static string StateName(CollectionReviewIssueStatus status)
    {
        return status switch
        {
            CollectionReviewIssueStatus.Open => "open",
            CollectionReviewIssueStatus.Dismissed => "dismissed",
            CollectionReviewIssueStatus.Resolved => "resolved",
            CollectionReviewIssueStatus.Reopened => "reopened",
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
