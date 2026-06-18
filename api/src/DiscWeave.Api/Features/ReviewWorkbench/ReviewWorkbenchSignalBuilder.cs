using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private const string TargetTypeProperty = "_targetType";
    private const string TargetReleaseIdProperty = "_targetReleaseId";
    private const string TargetTrackIdProperty = "_targetTrackId";
    private const string StatusProperty = "_status";
    private const string MediumTypeProperty = "_mediumType";
    private const string DigitalFilePathProperty = "_digitalFilePath";
    private const string DigitalFileFormatProperty = "_digitalFileFormat";
    private const string ImportIdentityContentHashProperty = "_importIdentityContentHash";
    private const string ConditionProperty = "_condition";
    private const string StorageLocationProperty = "_storageLocation";
    private const string ReleaseTargetType = "release";
    private const string TrackTargetType = "track";
    private static readonly AudioFileFormat?[] LossyFormats = [AudioFileFormat.Mp3, AudioFileFormat.Ogg, AudioFileFormat.M4a];
    private static readonly AudioFileFormat?[] LosslessFormats = [AudioFileFormat.Flac, AudioFileFormat.Wav, AudioFileFormat.Aiff, AudioFileFormat.Alac];

    public static async Task<IReadOnlyList<ReviewWorkbenchSignal>> BuildAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Release[] releases = await context.Releases.AsNoTracking()
            .Where(release => release.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        Track[] tracks = await context.Tracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        OwnedItemProjection[] ownedItems = await context.OwnedItems.AsNoTracking()
            .Where(item => item.CollectionId == collectionId)
            .Select(item => new OwnedItemProjection(
                item.Id,
                EF.Property<string>(item, TargetTypeProperty),
                EF.Property<ReleaseId?>(item, TargetReleaseIdProperty),
                EF.Property<TrackId?>(item, TargetTrackIdProperty),
                EF.Property<OwnershipStatus>(item, StatusProperty),
                EF.Property<string>(item, MediumTypeProperty),
                EF.Property<string?>(item, DigitalFilePathProperty),
                EF.Property<AudioFileFormat?>(item, DigitalFileFormatProperty),
                EF.Property<string?>(item, ImportIdentityContentHashProperty),
                EF.Property<ItemCondition?>(item, ConditionProperty),
                EF.Property<string?>(item, StorageLocationProperty)))
            .ToArrayAsync(cancellationToken);

        Dictionary<Guid, string> releaseTitles = releases.ToDictionary(release => release.Id.Value, release => release.Summary.Title);
        Dictionary<Guid, string> trackTitles = tracks.ToDictionary(track => track.Id.Value, track => track.Title);
        List<ReviewWorkbenchSignal> signals = [];

        signals.AddRange(DuplicateGroupSignals(
            collectionId,
            releases,
            release => release.Summary.Title,
            release => Target(ReviewWorkbenchTargetKinds.Release, release.Id.Value, release.Summary.Title),
            ReviewWorkbenchSubtypes.DuplicateReleases,
            "Duplicate release title"));
        signals.AddRange(DuplicateGroupSignals(
            collectionId,
            tracks,
            track => track.Title,
            track => Target(ReviewWorkbenchTargetKinds.Track, track.Id.Value, track.Title),
            ReviewWorkbenchSubtypes.DuplicateTracks,
            "Duplicate track title"));
        signals.AddRange(DigitalIdentitySignals(collectionId, ownedItems, releaseTitles, trackTitles));
        signals.AddRange(MissingMetadataSignals(collectionId, releases, tracks, ownedItems, releaseTitles, trackTitles));
        signals.AddRange(FormatGapSignals(collectionId, ownedItems, releaseTitles, trackTitles));

        return [.. signals.OrderBy(signal => signal.Category, StringComparer.Ordinal)
            .ThenBy(signal => signal.Subtype, StringComparer.Ordinal)
            .ThenBy(signal => signal.Title, StringComparer.OrdinalIgnoreCase)
            .ThenBy(signal => signal.StableKey, StringComparer.Ordinal)];
    }

    private static IEnumerable<ReviewWorkbenchSignal> DuplicateGroupSignals<TItem>(
        CollectionId collectionId,
        IEnumerable<TItem> items,
        Func<TItem, string> keySelector,
        Func<TItem, ReviewWorkbenchSignalTarget> targetSelector,
        string subtype,
        string titlePrefix)
    {
        return items
            .Select(item => (Key: keySelector(item).Trim(), Target: targetSelector(item)))
            .Where(item => item.Key.Length > 0)
            .GroupBy(item => NormalizeGroupKey(item.Key), StringComparer.Ordinal)
            .Where(group => group.Count() > 1)
            .Select(group =>
            {
                string displayKey = group.Select(item => item.Key).Order(StringComparer.OrdinalIgnoreCase).First();
                ReviewWorkbenchSignalTarget[] targets = [.. group.Select(item => item.Target).OrderBy(target => target.Id)];

                return CreateSignal(
                    collectionId,
                    ReviewWorkbenchCategories.DuplicateCandidates,
                    subtype,
                    $"{titlePrefix}: {displayKey}",
                    targets,
                    displayKey);
            });
    }

    private static IEnumerable<ReviewWorkbenchSignal> DigitalIdentitySignals(
        CollectionId collectionId,
        IEnumerable<OwnedItemProjection> ownedItems,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        return ownedItems
            .Select(item => (Key: DigitalIdentityKey(item), Target: OwnedItemTarget(item, releaseTitles, trackTitles)))
            .Where(item => !string.IsNullOrWhiteSpace(item.Key))
            .Select(item => (Key: item.Key ?? string.Empty, item.Target))
            .GroupBy(item => NormalizeGroupKey(item.Key), StringComparer.Ordinal)
            .Where(group => group.Count() > 1)
            .Select(group =>
            {
                string displayKey = group.Select(item => item.Key).Order(StringComparer.OrdinalIgnoreCase).First();
                ReviewWorkbenchSignalTarget[] targets = [.. group.Select(item => item.Target).OrderBy(target => target.Id)];

                return CreateSignal(
                    collectionId,
                    ReviewWorkbenchCategories.DuplicateCandidates,
                    ReviewWorkbenchSubtypes.DuplicateDigitalFileIdentities,
                    $"Duplicate digital file identity: {displayKey}",
                    targets,
                    displayKey);
            });
    }

    private static IEnumerable<ReviewWorkbenchSignal> MissingMetadataSignals(
        CollectionId collectionId,
        IEnumerable<Release> releases,
        IEnumerable<Track> tracks,
        IEnumerable<OwnedItemProjection> ownedItems,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        foreach (Release release in releases.Where(release => !release.Summary.Metadata.Year.HasValue && !release.Summary.Metadata.ReleaseDate.HasValue))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.ReleasesMissingYearOrDate,
                $"Release missing year or date: {release.Summary.Title}",
                Target(ReviewWorkbenchTargetKinds.Release, release.Id.Value, release.Summary.Title));
        }

        foreach (Release release in releases.Where(release => !release.Summary.Metadata.LabelId.HasValue && !release.IsNotOnLabel && release.Labels.Count == 0))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.ReleasesMissingLabel,
                $"Release missing label: {release.Summary.Title}",
                Target(ReviewWorkbenchTargetKinds.Release, release.Id.Value, release.Summary.Title));
        }

        foreach (Track track in tracks.Where(track => !track.Details.Duration.HasValue))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.TracksMissingDuration,
                $"Track missing duration: {track.Title}",
                Target(ReviewWorkbenchTargetKinds.Track, track.Id.Value, track.Title));
        }

        foreach (OwnedItemProjection item in ownedItems.Where(item => item.Condition is null && item.IsPhysical))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.OwnedItemsMissingCondition,
                $"Owned item missing condition: {OwnedItemTitle(item, releaseTitles, trackTitles)}",
                OwnedItemTarget(item, releaseTitles, trackTitles));
        }

        foreach (OwnedItemProjection item in ownedItems.Where(item => string.IsNullOrWhiteSpace(item.StorageLocation)))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.OwnedItemsMissingStorageLocation,
                $"Owned item missing storage location: {OwnedItemTitle(item, releaseTitles, trackTitles)}",
                OwnedItemTarget(item, releaseTitles, trackTitles));
        }

        foreach (OwnedItemProjection item in ownedItems.Where(item => item.MediumType == "digital" && item.DigitalFileFormat is null))
        {
            yield return SingleTargetSignal(
                collectionId,
                ReviewWorkbenchCategories.MissingMetadata,
                ReviewWorkbenchSubtypes.OwnedItemsMissingDigitalFormat,
                $"Owned digital item missing file format: {OwnedItemTitle(item, releaseTitles, trackTitles)}",
                OwnedItemTarget(item, releaseTitles, trackTitles));
        }
    }

}
