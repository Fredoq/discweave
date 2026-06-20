using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Seeding;

public static partial class LargeCollectionSeedGenerator
{
    private static void AddDigitalFileLinks(
        SeedGenerationState state,
        Release release,
        OwnedItem digitalOwnedItem,
        int releaseIndex)
    {
        foreach (ReleaseTrack releaseTrack in release.Tracklist)
        {
            if (ShouldLeaveMissingFileCoverage(releaseIndex, releaseTrack))
            {
                continue;
            }

            int position = releaseTrack.Position.Number;
            bool lossy = IsLossyOnlyDigitalAuditRelease(releaseIndex) || position % 5 == 0;
            AudioFileFormat format = lossy ? AudioFileFormat.Mp3 : AudioFileFormat.Flac;
            string extension = lossy ? "mp3" : "flac";
            string codec = lossy ? "mp3" : "flac";
            string contentHash = DuplicateContentHash(releaseIndex, position)
                ?? $"seed-{releaseIndex + 1:00000}-{position:00}-{extension}";
            LocalAudioFile localAudioFile = LocalAudioFile.Create(
                    state.CollectionId,
                    LocalAudioFileId.New(),
                    FilePath.FromAbsolutePath($"/Music/DiscWeave Seed/Seed Release {releaseIndex + 1:00000}/{position:00}. Seed Track.{extension}"))
                .WithFormat(format)
                .WithCodec(codec)
                .WithQuality(lossy ? AudioFileQuality.Lossy : AudioFileQuality.Lossless)
                .WithSizeBytes(4_000_000 + (releaseIndex * 1000L) + position)
                .WithModifiedAt(DateTimeOffset.UnixEpoch.AddDays(releaseIndex).AddMinutes(position))
                .WithContentHash(contentHash)
                .WithDuration(TimeSpan.FromSeconds(150 + ((releaseIndex + position) % 360)))
                .WithBitrateKbps(lossy ? 320 : 950)
                .WithSampleRateHz(44_100)
                .WithChannels(2);

            state.LocalAudioFiles.Add(localAudioFile);
            state.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
                state.CollectionId,
                DigitalTrackFileLinkId.New(),
                digitalOwnedItem.Id,
                releaseTrack.Id,
                localAudioFile.Id));
        }
    }

    private static bool ShouldCreateDigitalReleaseCopy(int releaseIndex)
    {
        return releaseIndex % 7 != 0 || IsLossyOnlyDigitalAuditRelease(releaseIndex);
    }

    private static bool ShouldLeaveMissingFileCoverage(int releaseIndex, ReleaseTrack releaseTrack)
    {
        return releaseIndex % 17 == 3 && releaseTrack.Position.Number == 1;
    }

    private static string? DuplicateContentHash(int releaseIndex, int position)
    {
        return releaseIndex % 19 == 4 && position is 1 or 2
            ? $"seed-duplicate-{releaseIndex:00000}"
            : null;
    }

    private static bool IsLossyOnlyDigitalAuditRelease(int releaseIndex)
    {
        return releaseIndex % 13 == 5;
    }
}
