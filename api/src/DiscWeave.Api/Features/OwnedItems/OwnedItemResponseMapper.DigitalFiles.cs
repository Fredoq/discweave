using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.OwnedItems;

internal static partial class OwnedItemResponseMapper
{
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
