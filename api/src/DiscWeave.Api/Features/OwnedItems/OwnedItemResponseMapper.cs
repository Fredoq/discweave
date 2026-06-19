using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace DiscWeave.Api.Features.OwnedItems;

internal static class OwnedItemResponseMapper
{
    private const string ReleaseIdProperty = "_releaseId";
    private const string ReleaseTargetType = "release";

    public static async Task<OwnedItemResponse> ToResponseAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        OwnedItem item,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<OwnedItemResponse> responses = await ToResponsesAsync(context, collectionId, [item], cancellationToken);
        return responses[0];
    }

    public static async Task<IReadOnlyList<OwnedItemResponse>> ToResponsesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<OwnedItem> items,
        CancellationToken cancellationToken)
    {
        if (items.Count == 0)
        {
            return [];
        }

        ReleaseId[] releaseIds = [.. items.Select(item => item.ReleaseId).Distinct()];
        Dictionary<ReleaseId, Release> releasesById = await LoadReleasesByIdAsync(context, collectionId, releaseIds, cancellationToken);
        OwnedItem[] targetOwnedItems = await LoadTargetOwnedItemsAsync(context, collectionId, releaseIds, cancellationToken);
        Dictionary<ReleaseId, OwnedItem[]> ownedItemsByReleaseId = BuildOwnedItemsByReleaseId(targetOwnedItems);

        return
        [
            .. items.Select(item =>
            {
                OwnedItemTargetResponse target = ToTargetResponse(item, releasesById);
                IReadOnlyList<string> inventorySignals = CollectorSignals(TargetOwnedItems(item, ownedItemsByReleaseId));
                return OwnedItemMapper.ToResponse(item, target, inventorySignals);
            })
        ];
    }

    private static async Task<Dictionary<ReleaseId, Release>> LoadReleasesByIdAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseId[] releaseIds,
        CancellationToken cancellationToken)
    {
        return releaseIds.Length == 0
            ? []
            : await context.Releases.AsNoTracking()
            .Where(release => release.CollectionId == collectionId && releaseIds.Contains(release.Id))
            .ToDictionaryAsync(release => release.Id, cancellationToken);
    }

    private static async Task<OwnedItem[]> LoadTargetOwnedItemsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseId[] releaseIds,
        CancellationToken cancellationToken)
    {
        return releaseIds.Length == 0
            ? []
            : await context.OwnedItems.AsNoTracking()
                .Where(item => item.CollectionId == collectionId)
                .Where(HasAnyReleaseId(releaseIds))
                .ToArrayAsync(cancellationToken);
    }

    private static Expression<Func<OwnedItem, bool>> HasAnyReleaseId(ReleaseId[] releaseIds)
    {
        Expression<Func<OwnedItem, ReleaseId>> itemReleaseId = item => EF.Property<ReleaseId>(item, ReleaseIdProperty);
        Expression? body = null;

        foreach (ReleaseId releaseId in releaseIds)
        {
            BinaryExpression targetMatches = Expression.Equal(
                itemReleaseId.Body,
                Expression.Constant(releaseId, typeof(ReleaseId)));
            body = body is null ? targetMatches : Expression.OrElse(body, targetMatches);
        }

        return Expression.Lambda<Func<OwnedItem, bool>>(body ?? Expression.Constant(false), itemReleaseId.Parameters);
    }

    private static OwnedItemTargetResponse ToTargetResponse(
        OwnedItem item,
        IReadOnlyDictionary<ReleaseId, Release> releasesById)
    {
        return ToReleaseTargetResponse(item.ReleaseId, releasesById);
    }

    private static OwnedItemTargetResponse ToReleaseTargetResponse(
        ReleaseId releaseId,
        IReadOnlyDictionary<ReleaseId, Release> releasesById)
    {
        string title = releasesById.TryGetValue(releaseId, out Release? release) ? release.Summary.Title : "Unknown release";

        return new OwnedItemTargetResponse(
            ReleaseTargetType,
            releaseId.Value,
            title,
            "release",
            releaseId.Value,
            title);
    }

    private static OwnedItem[] TargetOwnedItems(
        OwnedItem item,
        Dictionary<ReleaseId, OwnedItem[]> ownedItemsByReleaseId)
    {
        return ownedItemsByReleaseId.TryGetValue(item.ReleaseId, out OwnedItem[]? items) ? items : [item];
    }

    private static IReadOnlyList<string> CollectorSignals(IReadOnlyList<OwnedItem> items)
    {
        bool hasDigital = items.Any(item => item.Holding.Medium is DigitalFile);
        bool hasPhysical = items.Any(item => item.Holding.Medium is not DigitalFile);
        bool hasLossless = items.Any(item => item.Holding.Medium is DigitalFile digital && IsLossless(digital.Format));
        bool hasLossy = items.Any(item => item.Holding.Medium is DigitalFile digital && !IsLossless(digital.Format));
        List<string> signals = [.. items.Select(item => item.Holding.Medium.Code), .. items.Select(item => OwnedItemMapper.ToOwnershipStatusCode(item.Holding.Status))];
        if (hasPhysical && !hasDigital)
        {
            signals.Add("physicalWithoutDigital");
        }

        if (hasLossy && !hasLossless)
        {
            signals.Add("lossyWithoutLossless");
        }

        if (items.Any(item => item.Holding.Status == OwnershipStatus.Wanted) && !items.Any(item => item.Holding.Status == OwnershipStatus.Owned))
        {
            signals.Add("wantedNotOwned");
        }

        return
        [
            .. signals
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(signal => signal, StringComparer.OrdinalIgnoreCase)
        ];
    }

    private static bool IsLossless(AudioFileFormat format)
    {
        return format is AudioFileFormat.Flac or AudioFileFormat.Wav or AudioFileFormat.Aiff or AudioFileFormat.Alac;
    }

    private static Dictionary<ReleaseId, OwnedItem[]> BuildOwnedItemsByReleaseId(IReadOnlyList<OwnedItem> ownedItems)
    {
        return ownedItems
            .GroupBy(item => item.ReleaseId)
            .ToDictionary(group => group.Key, group => group.ToArray());
    }
}
