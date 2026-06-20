using DiscWeave.Api.Features.ReviewWorkbench;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Exports;

public static partial class ExportsEndpointRouteBuilderExtensions
{
    private static async Task<IReadOnlyList<LocalAudioFileExportResponse>> LoadLocalAudioFilesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.LocalAudioFiles.AsNoTracking()
                .Where(file => file.CollectionId == collectionId)
                .OrderBy(file => file.Path)
                .ToArrayAsync(cancellationToken))
                .Select(ToLocalAudioFileExportResponse)
        ];
    }

    private static async Task<IReadOnlyList<DigitalTrackFileLinkExportResponse>> LoadDigitalTrackFileLinksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        return
        [
            .. (await context.DigitalTrackFileLinks.AsNoTracking()
                .Where(link => link.CollectionId == collectionId)
                .OrderBy(link => link.Id)
                .ToArrayAsync(cancellationToken))
                .Select(link => new DigitalTrackFileLinkExportResponse(
                    link.Id.Value,
                    link.DigitalOwnedItemId.Value,
                    link.ReleaseTrackId.Value,
                    link.LocalAudioFileId.Value))
        ];
    }

    private static async Task<IReadOnlyList<ReviewReportItemResponse>> LoadReviewReportItemsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<ReviewWorkbenchSignal> signals = await ReviewWorkbenchSignalBuilder.BuildAsync(
            context,
            collectionId,
            cancellationToken);

        return
        [
            .. signals.SelectMany(signal => signal.Targets.Select(target => new ReviewReportItemResponse(
                signal.Category,
                signal.Subtype,
                signal.Title,
                signal.SourceDetector,
                target.Kind,
                target.Id,
                target.Title,
                target.Subtitle)))
        ];
    }

    private static LocalAudioFileExportResponse ToLocalAudioFileExportResponse(LocalAudioFile file)
    {
        return new LocalAudioFileExportResponse(
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

    private static long? OptionalLong(IOptionalValue<long>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(value => value, () => 0L) : null;
    }

    private static DateTimeOffset? OptionalDateTimeOffset(IOptionalValue<DateTimeOffset>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(value => value, () => DateTimeOffset.UnixEpoch) : null;
    }

    private static int? OptionalDurationSeconds(IOptionalValue<TimeSpan>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(value => (int)value.TotalSeconds, () => 0) : null;
    }

    private static string? OptionalAudioFormat(IOptionalValue<AudioFileFormat>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(ToAudioFileFormatCode, () => string.Empty) : null;
    }

    private static string? OptionalAudioQuality(IOptionalValue<AudioFileQuality>? optional)
    {
        return optional is { HasValue: true } ? optional.Match(ToAudioFileQualityCode, () => string.Empty) : null;
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
