using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private static IEnumerable<ReviewWorkbenchSignal> FormatGapSignals(
        CollectionId collectionId,
        IEnumerable<OwnedItemProjection> ownedItems,
        IReadOnlyList<ReleaseTrack> releaseTracks,
        IReadOnlyList<LocalAudioFile> localAudioFiles,
        IReadOnlyList<DigitalTrackFileLink> digitalTrackFileLinks,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        TargetGroup[] targetGroups = [.. ownedItems
            .Select(item => new TargetItem(
                new TargetKey(ReleaseTargetType, TargetId(item)),
                item.Status,
                item.MediumType))
            .Where(item => item.TargetKey.Id != Guid.Empty)
            .GroupBy(item => item.TargetKey)
            .Select(group => new TargetGroup(group.Key, [.. group]))];

        foreach (TargetGroup group in targetGroups.Where(group => group.Items.Any(item => item.IsPhysical) && !group.Items.Any(item => item.IsDigital)))
        {
            yield return TargetGroupSignal(collectionId, ReviewWorkbenchSubtypes.PhysicalWithoutDigital, "Physical copy without digital copy", group, releaseTitles, trackTitles);
        }

        foreach (TargetGroup group in targetGroups.Where(group => group.Items.Any(item => item.Status == OwnershipStatus.Wanted) && !group.Items.Any(item => item.Status == OwnershipStatus.Owned)))
        {
            yield return TargetGroupSignal(collectionId, ReviewWorkbenchSubtypes.WantedNotOwned, "Wanted item not owned", group, releaseTitles, trackTitles);
        }

        foreach (TargetGroup group in targetGroups.Where(group => group.Items.Any(item => item.Status == OwnershipStatus.NeedsDigitization)))
        {
            yield return TargetGroupSignal(collectionId, ReviewWorkbenchSubtypes.NeedsDigitization, "Item needs digitization", group, releaseTitles, trackTitles);
        }

        foreach (ReviewWorkbenchSignal signal in LossyWithoutLosslessSignals(
            collectionId,
            releaseTracks,
            localAudioFiles,
            digitalTrackFileLinks,
            releaseTitles,
            trackTitles))
        {
            yield return signal;
        }
    }

    private static ReviewWorkbenchSignal TargetGroupSignal(
        CollectionId collectionId,
        string subtype,
        string titlePrefix,
        TargetGroup group,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        string title = ResolveTargetTitle(group.TargetKey.Type, group.TargetKey.Id, releaseTitles, trackTitles);
        return SingleTargetSignal(
            collectionId,
            ReviewWorkbenchCategories.FormatGaps,
            subtype,
            $"{titlePrefix}: {title}",
            Target(group.TargetKey.Type, group.TargetKey.Id, title));
    }

    private static ReviewWorkbenchSignal SingleTargetSignal(
        CollectionId collectionId,
        string category,
        string subtype,
        string title,
        ReviewWorkbenchSignalTarget target)
    {
        return CreateSignal(collectionId, category, subtype, title, [target], comparisonKey: null);
    }

    private static ReviewWorkbenchSignal CreateSignal(
        CollectionId collectionId,
        string category,
        string subtype,
        string title,
        IReadOnlyList<ReviewWorkbenchSignalTarget> targets,
        string? comparisonKey)
    {
        return CreateSignal(
            collectionId,
            category,
            subtype,
            title,
            targets,
            comparisonKey,
            ReviewWorkbenchSourceDetectors.CatalogQuality);
    }

    private static ReviewWorkbenchSignal CreateSignal(
        CollectionId collectionId,
        string category,
        string subtype,
        string title,
        IReadOnlyList<ReviewWorkbenchSignalTarget> targets,
        string? comparisonKey,
        string sourceDetector)
    {
        return new ReviewWorkbenchSignal
        {
            StableKey = ReviewWorkbenchStableKey.Create(
                collectionId,
                category,
                subtype,
                sourceDetector,
                targets,
                comparisonKey),
            Category = category,
            Subtype = subtype,
            Title = title,
            SourceDetector = sourceDetector,
            Targets = targets,
            ComparisonKey = comparisonKey
        };
    }

    private static ReviewWorkbenchSignalTarget Target(string kind, Guid id, string title, string? subtitle = null)
    {
        return new ReviewWorkbenchSignalTarget
        {
            Kind = NormalizeTargetKind(kind),
            Id = id,
            Title = title,
            Subtitle = subtitle,
            NavigationTarget = NavigationTarget(kind, id)
        };
    }

    private static ReviewWorkbenchSignalTarget OwnedItemTarget(
        OwnedItemProjection item,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        return Target(ReviewWorkbenchTargetKinds.OwnedItem, item.Id.Value, OwnedItemTitle(item, releaseTitles, trackTitles)) with
        {
            CatalogTargetKind = ReviewWorkbenchTargetKinds.Release
        };
    }

    private static string OwnedItemTitle(
        OwnedItemProjection item,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        return ResolveTargetTitle(ReleaseTargetType, TargetId(item), releaseTitles, trackTitles);
    }

    private static ReviewWorkbenchNavigationTarget? NavigationTarget(string kind, Guid id)
    {
        return NormalizeTargetKind(kind) switch
        {
            ReviewWorkbenchTargetKinds.Release => new ReviewWorkbenchNavigationTarget
            {
                Kind = ReviewWorkbenchTargetKinds.Release,
                Id = id,
                Path = $"/catalog/releases/{id:D}"
            },
            ReviewWorkbenchTargetKinds.Track => new ReviewWorkbenchNavigationTarget
            {
                Kind = ReviewWorkbenchTargetKinds.Track,
                Id = id,
                Path = $"/catalog/tracks/{id:D}"
            },
            ReviewWorkbenchTargetKinds.OwnedItem => new ReviewWorkbenchNavigationTarget
            {
                Kind = ReviewWorkbenchTargetKinds.OwnedItem,
                Id = id,
                Path = $"/collection/items/{id:D}"
            },
            ReviewWorkbenchTargetKinds.ImportSession => new ReviewWorkbenchNavigationTarget
            {
                Kind = ReviewWorkbenchTargetKinds.ImportSession,
                Id = id,
                Path = "/imports"
            },
            _ => null
        };
    }

    private static string NormalizeTargetKind(string kind)
    {
        return kind switch
        {
            ReleaseTargetType => ReviewWorkbenchTargetKinds.Release,
            _ => kind
        };
    }

    private static string NormalizeGroupKey(string key)
    {
        return key.Trim().ToUpperInvariant();
    }

    private static Guid TargetId(OwnedItemProjection item)
    {
        return item.ReleaseId.Value;
    }

    private static string ResolveTargetTitle(
        string targetType,
        Guid targetId,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        return targetType switch
        {
            ReleaseTargetType when releaseTitles.TryGetValue(targetId, out string? title) => title,
            ReviewWorkbenchTargetKinds.Release when releaseTitles.TryGetValue(targetId, out string? title) => title,
            ReviewWorkbenchTargetKinds.Track when trackTitles.TryGetValue(targetId, out string? title) => title,
            _ => targetId.ToString("D")
        };
    }

    private sealed record OwnedItemProjection(
        OwnedItemId Id,
        ReleaseId ReleaseId,
        OwnershipStatus Status,
        string MediumType,
        ItemCondition? Condition,
        string? StorageLocation)
    {
        public bool IsDigital => string.Equals(MediumType, "digital", StringComparison.OrdinalIgnoreCase);

        public bool IsPhysical => !IsDigital;
    }

    private sealed record TargetKey(string Type, Guid Id);

    private sealed record TargetItem(
        TargetKey TargetKey,
        OwnershipStatus Status,
        string MediumType)
    {
        public bool IsDigital => string.Equals(MediumType, "digital", StringComparison.OrdinalIgnoreCase);

        public bool IsPhysical => !IsDigital;
    }

    private sealed record TargetGroup(TargetKey TargetKey, IReadOnlyList<TargetItem> Items);
}
