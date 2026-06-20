using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Exports;

public static partial class ExportsEndpointRouteBuilderExtensions
{
    private static void RestoreLocalAudioFiles(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<LocalAudioFileExportResponse> localAudioFiles)
    {
        foreach (LocalAudioFileExportResponse response in localAudioFiles)
        {
            var file = LocalAudioFile.Create(
                collectionId,
                new LocalAudioFileId(response.Id),
                FilePath.FromAbsolutePath(response.Path));
            ApplyLocalAudioFileMetadata(file, response);
            _ = context.LocalAudioFiles.Add(file);
        }
    }

    private static void RestoreDigitalTrackFileLinks(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<DigitalTrackFileLinkExportResponse> digitalTrackFileLinks)
    {
        foreach (DigitalTrackFileLinkExportResponse response in digitalTrackFileLinks)
        {
            _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
                collectionId,
                new DigitalTrackFileLinkId(response.Id),
                new OwnedItemId(response.DigitalOwnedItemId),
                new ReleaseTrackId(response.ReleaseTrackId),
                new LocalAudioFileId(response.LocalAudioFileId)));
        }
    }

    private static void ApplyLocalAudioFileMetadata(LocalAudioFile file, LocalAudioFileExportResponse response)
    {
        if (!string.IsNullOrWhiteSpace(response.Format))
        {
            _ = file.WithFormat(ParseAudioFileFormat(response.Format));
        }

        if (!string.IsNullOrWhiteSpace(response.Codec))
        {
            _ = file.WithCodec(response.Codec);
        }

        if (!string.IsNullOrWhiteSpace(response.Quality))
        {
            _ = file.WithQuality(ParseAudioFileQuality(response.Quality));
        }

        if (response.SizeBytes is { } sizeBytes)
        {
            _ = file.WithSizeBytes(sizeBytes);
        }

        if (response.ModifiedAt is { } modifiedAt)
        {
            _ = file.WithModifiedAt(modifiedAt);
        }

        if (!string.IsNullOrWhiteSpace(response.ContentHash))
        {
            _ = file.WithContentHash(response.ContentHash);
        }

        if (response.DurationSeconds is { } durationSeconds)
        {
            _ = file.WithDuration(TimeSpan.FromSeconds(durationSeconds));
        }

        if (response.BitrateKbps is { } bitrateKbps)
        {
            _ = file.WithBitrateKbps(bitrateKbps);
        }

        if (response.SampleRateHz is { } sampleRateHz)
        {
            _ = file.WithSampleRateHz(sampleRateHz);
        }

        if (response.Channels is { } channels)
        {
            _ = file.WithChannels(channels);
        }
    }
}
