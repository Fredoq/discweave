using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<Dictionary<TrackId, TrackDigitalFileResponse[]>> LoadDigitalFilesByTrackIdAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release[] appearanceReleases,
        TrackId[] trackIds,
        CancellationToken cancellationToken)
    {
        if (appearanceReleases.Length == 0 || trackIds.Length == 0)
        {
            return [];
        }

        TrackDigitalFileContext[] releaseTrackContexts =
        [
            .. appearanceReleases.SelectMany(release => release.Tracklist
                .Where(releaseTrack => trackIds.Contains(releaseTrack.TrackId))
                .Select(releaseTrack => new TrackDigitalFileContext(release, releaseTrack)))
        ];
        if (releaseTrackContexts.Length == 0)
        {
            return [];
        }

        ReleaseTrackId[] releaseTrackIds = [.. releaseTrackContexts.Select(contextRow => contextRow.ReleaseTrack.Id).Distinct()];
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && releaseTrackIds.Contains(link.ReleaseTrackId))
            .ToArrayAsync(cancellationToken);
        if (links.Length == 0)
        {
            return [];
        }

        LocalAudioFileId[] localAudioFileIds = [.. links.Select(link => link.LocalAudioFileId).Distinct()];
        Dictionary<LocalAudioFileId, LocalAudioFile> filesById = await context.LocalAudioFiles.AsNoTracking()
            .Where(file => file.CollectionId == collectionId && localAudioFileIds.Contains(file.Id))
            .ToDictionaryAsync(file => file.Id, cancellationToken);
        Dictionary<ReleaseTrackId, TrackDigitalFileContext> contextsByReleaseTrackId = releaseTrackContexts
            .ToDictionary(contextRow => contextRow.ReleaseTrack.Id);

        var responsesByTrackId = new Dictionary<TrackId, List<TrackDigitalFileResponse>>();
        foreach (DigitalTrackFileLink link in links)
        {
            if (!filesById.TryGetValue(link.LocalAudioFileId, out LocalAudioFile? file) ||
                !contextsByReleaseTrackId.TryGetValue(link.ReleaseTrackId, out TrackDigitalFileContext? contextRow))
            {
                continue;
            }

            TrackId trackId = contextRow.ReleaseTrack.TrackId;
            if (!responsesByTrackId.TryGetValue(trackId, out List<TrackDigitalFileResponse>? responses))
            {
                responses = [];
                responsesByTrackId[trackId] = responses;
            }

            responses.Add(ToTrackDigitalFileResponse(link, contextRow.Release, contextRow.ReleaseTrack, file));
        }

        return responsesByTrackId.ToDictionary(
            pair => pair.Key,
            pair => pair.Value
                .OrderBy(response => response.ReleaseTitle, StringComparer.OrdinalIgnoreCase)
                .ThenBy(response => response.Position)
                .ThenBy(response => response.Path, StringComparer.OrdinalIgnoreCase)
                .ToArray());
    }

    private static TrackDigitalFileResponse ToTrackDigitalFileResponse(
        DigitalTrackFileLink link,
        Release release,
        ReleaseTrack releaseTrack,
        LocalAudioFile file)
    {
        return new TrackDigitalFileResponse(
            link.Id.Value,
            file.Id.Value,
            link.DigitalOwnedItemId.Value,
            release.Id.Value,
            release.Summary.Title,
            releaseTrack.Id.Value,
            releaseTrack.Position.Number,
            OptionalString(releaseTrack.Position.Disc),
            OptionalString(releaseTrack.Position.Side),
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

    private sealed record TrackDigitalFileContext(Release Release, ReleaseTrack ReleaseTrack);
}
