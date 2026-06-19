using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace DiscWeave.Api.Features.OwnedItems;

internal static class OwnedItemResponseMapper
{
    private const string ReleaseIdProperty = "_releaseId";

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
        Dictionary<OwnedItemId, DigitalFileCoverageResponse[]> digitalFilesByOwnedItemId = await LoadDigitalFileCoverageAsync(
            context,
            collectionId,
            items,
            releasesById,
            cancellationToken);

        return
        [
            .. items.Select(item =>
            {
                OwnedItemReleaseResponse release = ToReleaseResponse(item.ReleaseId, releasesById);
                IReadOnlyList<string> inventorySignals = CollectorSignals(TargetOwnedItems(item, ownedItemsByReleaseId));
                OwnedItemDetailsResponse details = ToDetailsResponse(item, releasesById, digitalFilesByOwnedItemId);
                return OwnedItemMapper.ToResponse(item, release, details, inventorySignals);
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

    private static async Task<Dictionary<OwnedItemId, DigitalFileCoverageResponse[]>> LoadDigitalFileCoverageAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<OwnedItem> items,
        IReadOnlyDictionary<ReleaseId, Release> releasesById,
        CancellationToken cancellationToken)
    {
        OwnedItemId[] digitalOwnedItemIds =
        [
            .. items
                .Where(item => item.Holding.Medium is DigitalFile)
                .Select(item => item.Id)
                .Distinct()
        ];
        if (digitalOwnedItemIds.Length == 0)
        {
            return [];
        }

        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && digitalOwnedItemIds.Contains(link.DigitalOwnedItemId))
            .ToArrayAsync(cancellationToken);
        if (links.Length == 0)
        {
            return [];
        }

        LocalAudioFileId[] localAudioFileIds = [.. links.Select(link => link.LocalAudioFileId).Distinct()];
        Dictionary<LocalAudioFileId, LocalAudioFile> filesById = await context.LocalAudioFiles.AsNoTracking()
            .Where(file => file.CollectionId == collectionId && localAudioFileIds.Contains(file.Id))
            .ToDictionaryAsync(file => file.Id, cancellationToken);

        var releaseTracksById = releasesById.Values
            .SelectMany(release => release.Tracklist)
            .ToDictionary(releaseTrack => releaseTrack.Id);
        TrackId[] trackIds =
        [
            .. releaseTracksById.Values
                .Where(releaseTrack => links.Any(link => link.ReleaseTrackId == releaseTrack.Id))
                .Select(releaseTrack => releaseTrack.TrackId)
                .Distinct()
        ];
        Dictionary<TrackId, Track> tracksById = trackIds.Length == 0
            ? []
            : await context.Tracks.AsNoTracking()
                .Where(track => track.CollectionId == collectionId && trackIds.Contains(track.Id))
                .ToDictionaryAsync(track => track.Id, cancellationToken);

        var responsesByOwnedItemId = new Dictionary<OwnedItemId, List<DigitalFileCoverageResponse>>();
        foreach (DigitalTrackFileLink link in links)
        {
            if (!filesById.TryGetValue(link.LocalAudioFileId, out LocalAudioFile? file) ||
                !releaseTracksById.TryGetValue(link.ReleaseTrackId, out ReleaseTrack? releaseTrack))
            {
                continue;
            }

            if (!responsesByOwnedItemId.TryGetValue(link.DigitalOwnedItemId, out List<DigitalFileCoverageResponse>? responses))
            {
                responses = [];
                responsesByOwnedItemId[link.DigitalOwnedItemId] = responses;
            }

            responses.Add(ToDigitalFileCoverageResponse(link, releaseTrack, file, tracksById));
        }

        return responsesByOwnedItemId.ToDictionary(
            pair => pair.Key,
            pair => pair.Value
                .OrderBy(response => response.Position)
                .ThenBy(response => response.Path, StringComparer.OrdinalIgnoreCase)
                .ToArray());
    }

    private static DigitalFileCoverageResponse ToDigitalFileCoverageResponse(
        DigitalTrackFileLink link,
        ReleaseTrack releaseTrack,
        LocalAudioFile file,
        Dictionary<TrackId, Track> tracksById)
    {
        return new DigitalFileCoverageResponse(
            link.Id.Value,
            releaseTrack.Id.Value,
            releaseTrack.TrackId.Value,
            tracksById.TryGetValue(releaseTrack.TrackId, out Track? track) ? track.Title : "Unknown track",
            releaseTrack.Position.Number,
            OptionalString(releaseTrack.Position.Disc),
            OptionalString(releaseTrack.Position.Side),
            file.Id.Value,
            file.Path.Value,
            OptionalAudioFormat(file.Format),
            OptionalString(file.Codec),
            OptionalAudioQuality(file.Quality),
            OptionalLong(file.SizeBytes),
            OptionalDateTimeOffset(file.ModifiedAt),
            OptionalString(file.ContentHash),
            OptionalDurationSeconds(file.Duration),
            OptionalInt(file.BitrateKbps),
            OptionalInt(file.SampleRateHz),
            OptionalInt(file.Channels));
    }

    private static OwnedItemReleaseResponse ToReleaseResponse(
        ReleaseId releaseId,
        Dictionary<ReleaseId, Release> releasesById)
    {
        string title = releasesById.TryGetValue(releaseId, out Release? release) ? release.Summary.Title : "Unknown release";

        return new OwnedItemReleaseResponse(releaseId.Value, title);
    }

    private static OwnedItemDetailsResponse ToDetailsResponse(
        OwnedItem item,
        Dictionary<ReleaseId, Release> releasesById,
        IReadOnlyDictionary<OwnedItemId, DigitalFileCoverageResponse[]> digitalFilesByOwnedItemId)
    {
        int releaseTrackCount = releasesById.TryGetValue(item.ReleaseId, out Release? release)
            ? release.Tracklist.Count
            : 0;

        return item.Holding.Medium switch
        {
            DigitalFile => ToDigitalDetailsResponse(item, releaseTrackCount, digitalFilesByOwnedItemId),
            VinylRecord vinylRecord => OwnedItemDetailsResponse.ForVinyl(new VinylOwnedItemDetailsResponse(
                vinylRecord.FormatDescription,
                OwnedItemMapper.ToItemConditionCodeOrNull(item),
                OwnedItemMapper.ToStorageLocationOrNull(item))),
            CompactDisc compactDisc => OwnedItemDetailsResponse.ForCd(new CdOwnedItemDetailsResponse(
                compactDisc.DiscCount,
                OwnedItemMapper.ToItemConditionCodeOrNull(item),
                OwnedItemMapper.ToStorageLocationOrNull(item))),
            CassetteTape cassetteTape => OwnedItemDetailsResponse.ForCassette(new CassetteOwnedItemDetailsResponse(
                cassetteTape.TapeType,
                OwnedItemMapper.ToItemConditionCodeOrNull(item),
                OwnedItemMapper.ToStorageLocationOrNull(item))),
            OtherMedium otherMedium => OwnedItemDetailsResponse.ForOther(new OtherOwnedItemDetailsResponse(
                otherMedium.Name,
                OwnedItemMapper.ToItemConditionCodeOrNull(item),
                OwnedItemMapper.ToStorageLocationOrNull(item))),
            _ => throw new InvalidOperationException("Medium type is not supported")
        };
    }

    private static OwnedItemDetailsResponse ToDigitalDetailsResponse(
        OwnedItem item,
        int releaseTrackCount,
        IReadOnlyDictionary<OwnedItemId, DigitalFileCoverageResponse[]> digitalFilesByOwnedItemId)
    {
        DigitalFileCoverageResponse[] files = digitalFilesByOwnedItemId.TryGetValue(item.Id, out DigitalFileCoverageResponse[]? responseFiles)
            ? responseFiles
            : [];

        return OwnedItemDetailsResponse.ForDigital(new DigitalOwnedItemDetailsResponse(
            releaseTrackCount,
            files.Length,
            Math.Max(0, releaseTrackCount - files.Length),
            files));
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
        List<string> signals = [.. items.Select(item => item.Holding.Medium.Code), .. items.Select(item => OwnedItemMapper.ToOwnershipStatusCode(item.Holding.Status))];
        if (hasPhysical && !hasDigital)
        {
            signals.Add("physicalWithoutDigital");
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

    private static Dictionary<ReleaseId, OwnedItem[]> BuildOwnedItemsByReleaseId(IReadOnlyList<OwnedItem> ownedItems)
    {
        return ownedItems
            .GroupBy(item => item.ReleaseId)
            .ToDictionary(group => group.Key, group => group.ToArray());
    }

    private static string? OptionalString(IOptionalValue<string>? value)
    {
        return value is { HasValue: true } ? value.Match(present => present, () => string.Empty) : null;
    }

    private static long? OptionalLong(IOptionalValue<long>? value)
    {
        return value is PresentOptionalValue<long> present ? present.Value : null;
    }

    private static int? OptionalInt(IOptionalValue<int>? value)
    {
        return value is PresentOptionalValue<int> present ? present.Value : null;
    }

    private static DateTimeOffset? OptionalDateTimeOffset(IOptionalValue<DateTimeOffset>? value)
    {
        return value is PresentOptionalValue<DateTimeOffset> present ? present.Value : null;
    }

    private static int? OptionalDurationSeconds(IOptionalValue<TimeSpan>? value)
    {
        return value is PresentOptionalValue<TimeSpan> present ? (int)present.Value.TotalSeconds : null;
    }

    private static string? OptionalAudioFormat(IOptionalValue<AudioFileFormat>? value)
    {
        return value is { HasValue: true } ? value.Match(ToAudioFileFormatCode, () => string.Empty) : null;
    }

    private static string? OptionalAudioQuality(IOptionalValue<AudioFileQuality>? value)
    {
        return value is { HasValue: true } ? value.Match(ToAudioFileQualityCode, () => string.Empty) : null;
    }

    private static string ToAudioFileFormatCode(AudioFileFormat format)
    {
        return format switch
        {
            AudioFileFormat.Flac => "flac",
            AudioFileFormat.Mp3 => "mp3",
            AudioFileFormat.Ogg => "ogg",
            AudioFileFormat.Wav => "wav",
            AudioFileFormat.Aiff => "aiff",
            AudioFileFormat.Alac => "alac",
            AudioFileFormat.M4a => "m4a",
            _ => throw new InvalidOperationException("Audio file format is not supported")
        };
    }

    private static string ToAudioFileQualityCode(AudioFileQuality quality)
    {
        return quality switch
        {
            AudioFileQuality.Lossless => "lossless",
            AudioFileQuality.Lossy => "lossy",
            _ => throw new InvalidOperationException("Audio file quality is not supported")
        };
    }
}
