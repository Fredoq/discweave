using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Collection;

public sealed class DigitalFileImportIdentityTests
{
    [Fact]
    public void Digital_file_can_carry_import_identity_for_deduplication()
    {
        var path = FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac");
        var identity = FileImportIdentity.Create(
            path,
            123_456,
            new DateTimeOffset(2025, 1, 2, 3, 4, 5, TimeSpan.Zero),
            " ABCDEF ");
        var file = DigitalFile.Create(path, AudioFileFormat.Flac, identity);

        Assert.Equal(path, file.Path);
        FileImportIdentity actualIdentity = Assert.IsType<PresentOptionalValue<FileImportIdentity>>(file.ImportIdentity).Value;

        Assert.Equal(123_456, actualIdentity.SizeBytes);
        Assert.Equal("abcdef", Assert.IsType<PresentOptionalValue<string>>(actualIdentity.ContentHash).Value);
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
    public void File_import_identity_requires_matching_file_path_and_positive_size()
    {
        var path = FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac");
        var otherPath = FilePath.FromAbsolutePath("/music/New Order/Confusion.flac");
        var identity = FileImportIdentity.Create(
            otherPath,
            1,
            DateTimeOffset.UnixEpoch);

        Assert.Equal(
            "file_import_identity.size_required",
            Assert.Throws<DomainException>(() => FileImportIdentity.Create(path, 0, DateTimeOffset.UnixEpoch)).Code);
        Assert.Equal(
            "digital_file.import_identity_path_mismatch",
            Assert.Throws<DomainException>(() => DigitalFile.Create(path, AudioFileFormat.Flac, identity)).Code);
    }
}
