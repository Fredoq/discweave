using System.Text.Json;
using DiscWeave.Api.Auth;
using DiscWeave.Api.Http;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Review;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchEndpointRouteBuilderExtensions
{
    private static readonly JsonSerializerOptions TargetsJsonOptions = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapReviewWorkbenchEndpoints(this IEndpointRouteBuilder endpoints)
    {
        ArgumentNullException.ThrowIfNull(endpoints);

        RouteGroupBuilder group = endpoints.MapGroup("/api/review-workbench")
            .WithTags("Review Workbench")
            .RequireAuthorization(DiscWeaveAuthorizationPolicies.CollectionMember);

        _ = group.MapPost("/refresh", RefreshAsync).WithName("RefreshReviewWorkbench");
        _ = group.MapGet("/items", ListItemsAsync).WithName("ListReviewWorkbenchItems");
        _ = group.MapPatch("/items/{stableKey}/state", UpdateStateAsync).WithName("UpdateReviewWorkbenchItemState");

        return endpoints;
    }

    private static async Task<IResult> RefreshAsync(
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        DateTimeOffset now = DateTimeOffset.UtcNow;
        IReadOnlyList<ReviewWorkbenchSignal> signals = await ReviewWorkbenchSignalBuilder.BuildAsync(
            context,
            currentCollection.CollectionId,
            cancellationToken);
        var signalsByKey = signals.ToDictionary(signal => signal.StableKey, StringComparer.Ordinal);
        CollectionReviewIssueState[] states = await context.CollectionReviewIssueStates
            .Where(state => state.CollectionId == currentCollection.CollectionId)
            .ToArrayAsync(cancellationToken);
        Dictionary<string, CollectionReviewIssueState> statesByKey = states.ToDictionary(state => state.StableKey, StringComparer.Ordinal);
        int created = 0;
        int updated = 0;
        int systemResolved = 0;

        foreach (ReviewWorkbenchSignal signal in signals)
        {
            CollectionReviewIssueSnapshot snapshot = Snapshot(signal);
            if (!statesByKey.TryGetValue(signal.StableKey, out CollectionReviewIssueState? state))
            {
                state = CollectionReviewIssueState.Create(
                    currentCollection.CollectionId,
                    CollectionReviewIssueStateId.New(),
                    snapshot,
                    now);
                _ = context.CollectionReviewIssueStates.Add(state);
                created++;
                continue;
            }

            state.ApplySignal(snapshot, now);
            updated++;
        }

        foreach (CollectionReviewIssueState state in states)
        {
            if (signalsByKey.ContainsKey(state.StableKey) || state.Status == CollectionReviewIssueStatus.Resolved)
            {
                continue;
            }

            state.ResolveBySystem(now);
            systemResolved++;
        }

        _ = await context.SaveChangesAsync(cancellationToken);
        ReviewWorkbenchSummaryResponse summary = await SummaryAsync(context, currentCollection.CollectionId, cancellationToken);

        return Results.Ok(new ReviewWorkbenchRefreshResponse
        {
            GeneratedSignals = signals.Count,
            Created = created,
            Updated = updated,
            SystemResolved = systemResolved,
            Summary = summary
        });
    }

    private static async Task<IResult> ListItemsAsync(
        string? category,
        string? state,
        int? limit,
        int? offset,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        if (!Pagination.TryNormalize(limit, offset, out int normalizedLimit, out int normalizedOffset, out IResult paginationError))
        {
            return paginationError;
        }

        if (!TryNormalizeCategory(category, out string? normalizedCategory, out IResult categoryError))
        {
            return categoryError;
        }

        if (!TryParseStateFilter(state, out ReviewWorkbenchStateFilter stateFilter, out IResult stateError))
        {
            return stateError;
        }

        IReadOnlyList<ReviewWorkbenchSignal> signals = await ReviewWorkbenchSignalBuilder.BuildAsync(
            context,
            currentCollection.CollectionId,
            cancellationToken);
        CollectionReviewIssueState[] states = await context.CollectionReviewIssueStates
            .Where(item => item.CollectionId == currentCollection.CollectionId)
            .ToArrayAsync(cancellationToken);
        ReviewWorkbenchItemResponse[] allItems = [.. BuildItems(signals, states)];
        ReviewWorkbenchItemResponse[] items = [.. allItems
            .Where(item => normalizedCategory is null || item.Category == normalizedCategory)
            .Where(item => MatchesStateFilter(item.State, stateFilter))
            .OrderBy(item => item.Category, StringComparer.Ordinal)
            .ThenBy(item => item.Subtype, StringComparer.Ordinal)
            .ThenBy(item => item.Title, StringComparer.OrdinalIgnoreCase)
            .ThenBy(item => item.StableKey, StringComparer.Ordinal)];

        return Results.Ok(new ReviewWorkbenchListResponse
        {
            Items = [.. items.Skip(normalizedOffset).Take(normalizedLimit)],
            Limit = normalizedLimit,
            Offset = normalizedOffset,
            Total = items.Length,
            Summary = Summary(allItems)
        });
    }

    private static async Task<IResult> UpdateStateAsync(
        string stableKey,
        ReviewWorkbenchStateUpdateRequest request,
        DiscWeaveDbContext context,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        string normalizedStableKey = stableKey.Trim();
        if (!TryParseUpdateState(request.State, out ReviewWorkbenchUpdateState updateState, out IResult stateError))
        {
            return stateError;
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;
        CollectionReviewIssueState? state = await context.CollectionReviewIssueStates
            .SingleOrDefaultAsync(
                item => item.CollectionId == currentCollection.CollectionId && item.StableKey == normalizedStableKey,
                cancellationToken);

        if (state is null)
        {
            IReadOnlyList<ReviewWorkbenchSignal> signals = await ReviewWorkbenchSignalBuilder.BuildAsync(
                context,
                currentCollection.CollectionId,
                cancellationToken);
            ReviewWorkbenchSignal? signal = signals.SingleOrDefault(candidate => candidate.StableKey == normalizedStableKey);
            if (signal is null)
            {
                return EndpointErrors.NotFound("review_workbench.item_not_found", "Review Workbench item was not found");
            }

            state = CollectionReviewIssueState.Create(
                currentCollection.CollectionId,
                CollectionReviewIssueStateId.New(),
                Snapshot(signal),
                now);
            _ = context.CollectionReviewIssueStates.Add(state);
        }

        ApplyUpdate(state, updateState, now, request.Note ?? string.Empty);
        _ = await context.SaveChangesAsync(cancellationToken);

        return Results.Ok(ItemFromState(state));
    }

}
