using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Collection;

public sealed class DigitalFileImportIdentityTests
{
    [Fact]
    public void Digital_medium_is_a_file_agnostic_release_copy_type()
    {
        var file = DigitalFile.Create();

        Assert.Equal(OwnedItemType.Digital, file.Type);
        Assert.Equal("digital", file.Code);
        Assert.Equal("digital release copy", file.Description);
    }

    [Fact]
    public void Local_audio_file_can_carry_inspection_metadata_for_deduplication()
    {
        var path = FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac");
        var identity = FileImportIdentity.Create(
            path,
            123_456,
            new DateTimeOffset(2025, 1, 2, 3, 4, 5, TimeSpan.Zero),
            " ABCDEF ");
        LocalAudioFile file = LocalAudioFile.Create(CollectionId.New(), LocalAudioFileId.New(), path)
            .WithFormat(AudioFileFormat.Flac)
            .WithCodec("FLAC")
            .WithQuality(AudioFileQuality.Lossless)
            .WithSizeBytes(123_456)
            .WithModifiedAt(new DateTimeOffset(2025, 1, 2, 3, 4, 5, TimeSpan.Zero))
            .WithContentHash(" ABCDEF ")
            .WithDuration(TimeSpan.FromSeconds(316))
            .WithBitrateKbps(850)
            .WithSampleRateHz(44_100)
            .WithChannels(2)
            .WithImportIdentity(identity);

        Assert.Equal(path, file.Path);
        FileImportIdentity actualIdentity = Assert.IsType<PresentOptionalValue<FileImportIdentity>>(file.ImportIdentity).Value;

        Assert.Equal(AudioFileFormat.Flac, Assert.IsType<PresentOptionalValue<AudioFileFormat>>(file.Format).Value);
        Assert.Equal("FLAC", Assert.IsType<PresentOptionalValue<string>>(file.Codec).Value);
        Assert.Equal(AudioFileQuality.Lossless, Assert.IsType<PresentOptionalValue<AudioFileQuality>>(file.Quality).Value);
        Assert.Equal(123_456, actualIdentity.SizeBytes);
        Assert.Equal(123_456, Assert.IsType<PresentOptionalValue<long>>(file.SizeBytes).Value);
        Assert.Equal(TimeSpan.FromSeconds(316), Assert.IsType<PresentOptionalValue<TimeSpan>>(file.Duration).Value);
        Assert.Equal(850, Assert.IsType<PresentOptionalValue<int>>(file.BitrateKbps).Value);
        Assert.Equal(44_100, Assert.IsType<PresentOptionalValue<int>>(file.SampleRateHz).Value);
        Assert.Equal(2, Assert.IsType<PresentOptionalValue<int>>(file.Channels).Value);
        Assert.Equal("abcdef", Assert.IsType<PresentOptionalValue<string>>(actualIdentity.ContentHash).Value);
        Assert.Equal("abcdef", Assert.IsType<PresentOptionalValue<string>>(file.ContentHash).Value);
    }

    [Fact]
    public void File_import_identity_rejects_null_hash_values()
    {
        var path = FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac");

        _ = Assert.Throws<ArgumentNullException>(() =>
            FileImportIdentity.Create(
                path,
                123_456,
                DateTimeOffset.UnixEpoch,
                null!));
    }

    [Fact]
    public void File_import_identity_requires_positive_size()
    {
        var path = FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac");

        Assert.Equal(
            "file_import_identity.size_required",
            Assert.Throws<DomainException>(() => FileImportIdentity.Create(path, 0, DateTimeOffset.UnixEpoch)).Code);
    }

    [Fact]
    public void Local_audio_file_metadata_rejects_invalid_values()
    {
        var file = LocalAudioFile.Create(
            CollectionId.New(),
            LocalAudioFileId.New(),
            FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac"));

        Assert.Equal(
            "local_audio_file.format_invalid",
            Assert.Throws<DomainException>(() => file.WithFormat((AudioFileFormat)999)).Code);
        Assert.Equal(
            "local_audio_file.quality_invalid",
            Assert.Throws<DomainException>(() => file.WithQuality((AudioFileQuality)999)).Code);
        Assert.Equal(
            "local_audio_file.size_required",
            Assert.Throws<DomainException>(() => file.WithSizeBytes(0)).Code);
        Assert.Equal(
            "local_audio_file.duration_required",
            Assert.Throws<DomainException>(() => file.WithDuration(TimeSpan.Zero)).Code);
        Assert.Equal(
            "local_audio_file.bitrate_required",
            Assert.Throws<DomainException>(() => file.WithBitrateKbps(0)).Code);
        Assert.Equal(
            "local_audio_file.sample_rate_required",
            Assert.Throws<DomainException>(() => file.WithSampleRateHz(0)).Code);
        Assert.Equal(
            "local_audio_file.channels_required",
            Assert.Throws<DomainException>(() => file.WithChannels(0)).Code);
    }

    [Fact]
    public void Digital_track_file_link_preserves_connected_public_ids()
    {
        var collectionId = CollectionId.New();
        var linkId = DigitalTrackFileLinkId.New();
        var digitalOwnedItemId = OwnedItemId.New();
        var releaseTrackId = ReleaseTrackId.New();
        var localAudioFileId = LocalAudioFileId.New();

        var link = DigitalTrackFileLink.Create(
            collectionId,
            linkId,
            digitalOwnedItemId,
            releaseTrackId,
            localAudioFileId);

        Assert.Equal(collectionId, link.CollectionId);
        Assert.Equal(linkId, link.Id);
        Assert.Equal(digitalOwnedItemId, link.DigitalOwnedItemId);
        Assert.Equal(releaseTrackId, link.ReleaseTrackId);
        Assert.Equal(localAudioFileId, link.LocalAudioFileId);
    }
}
