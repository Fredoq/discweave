using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Tests.Collection;

public sealed class OwnedItemTests
{
    [Fact]
    public void Owned_item_targets_a_release_copy()
    {
        var collectionId = CollectionId.New();
        var ownedItemId = OwnedItemId.New();
        var releaseId = ReleaseId.New();

        var item = OwnedItem.Create(
            collectionId,
            ownedItemId,
            releaseId,
            OwnershipStatus.Owned,
            VinylRecord.Create("LP"));

        Assert.Equal(collectionId, item.CollectionId);
        Assert.Equal(ownedItemId, item.Id);
        Assert.Equal(releaseId, item.ReleaseId);
        Assert.Equal(OwnershipStatus.Owned, item.Holding.Status);
        _ = Assert.IsType<VinylRecord>(item.Holding.Medium);
    }

    [Fact]
    public void Owned_item_requires_a_concrete_medium_model()
    {
        var vinylItem = OwnedItem.Create(CollectionId.New(),
            OwnedItemId.New(),
            ReleaseId.New(),
            OwnershipStatus.NeedsDigitization,
            VinylRecord.Create("12-inch"));
        var cdItem = OwnedItem.Create(CollectionId.New(),
            OwnedItemId.New(),
            ReleaseId.New(),
            OwnershipStatus.Owned,
            CompactDisc.Create(1));
        var cassetteItem = OwnedItem.Create(CollectionId.New(),
            OwnedItemId.New(),
            ReleaseId.New(),
            OwnershipStatus.Wanted,
            CassetteTape.Create("Chrome"));

        _ = Assert.IsType<VinylRecord>(vinylItem.Holding.Medium);
        _ = Assert.IsType<CompactDisc>(cdItem.Holding.Medium);
        _ = Assert.IsType<CassetteTape>(cassetteItem.Holding.Medium);
    }

    [Fact]
    public void Concrete_media_models_validate_required_details()
    {
        Assert.Equal("vinyl_record.format_required", Assert.Throws<DomainException>(() => VinylRecord.Create(" ")).Code);
        Assert.Equal("compact_disc.disc_count_required", Assert.Throws<DomainException>(() => CompactDisc.Create(0)).Code);
        Assert.Equal("cassette_tape.type_required", Assert.Throws<DomainException>(() => CassetteTape.Create(" ")).Code);
        Assert.Equal("other_medium.name_required", Assert.Throws<DomainException>(() => OtherMedium.Create(" ")).Code);
    }

    [Fact]
    public void Audio_file_formats_are_a_closed_object_catalog()
    {
        Assert.Equal(AudioFileFormat.Ogg, AudioFileFormat.Ogg);
        Assert.NotEqual(AudioFileFormat.Flac, AudioFileFormat.Mp3);
    }

    [Fact]
    public void File_path_accepts_unix_and_windows_absolute_paths()
    {
        var unixPath = FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac");
        var windowsPath = FilePath.FromAbsolutePath(@"C:\music\New Order\Blue Monday.flac");

        Assert.Equal("/music/New Order/Blue Monday.flac", unixPath.Value);
        Assert.Equal(@"C:\music\New Order\Blue Monday.flac", windowsPath.Value);
    }

    [Fact]
    public void File_path_requires_absolute_paths()
    {
        DomainException exception = Assert.Throws<DomainException>(() => FilePath.FromAbsolutePath("relative/file.flac"));

        Assert.Equal("file_path.not_absolute", exception.Code);
    }

    [Fact]
    public void Digital_file_requires_path_and_format()
    {
        var path = FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac");

        var file = DigitalFile.Create(path, AudioFileFormat.Flac);

        Assert.False(file.ImportIdentity.HasValue);
    }

    [Fact]
    public void Digital_file_rejects_undefined_formats()
    {
        var path = FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac");

        Assert.Equal(
            "digital_file.format_invalid",
            Assert.Throws<DomainException>(() => DigitalFile.Create(path, (AudioFileFormat)999)).Code);
    }

    [Fact]
    public void Owned_item_can_store_condition_and_storage_location()
    {
        var collectionId = CollectionId.New();
        OwnedItem item = OwnedItem.Create(collectionId,
                OwnedItemId.New(),
                ReleaseId.New(),
                OwnershipStatus.Owned,
                VinylRecord.Create("LP"))
            .WithCondition(ItemCondition.VeryGoodPlus)
            .WithStorageLocation(StorageLocation.FromName("Shelf A"));

        Assert.Equal(OwnershipStatus.Owned, item.Holding.Status);
        Assert.Equal(collectionId, item.CollectionId);
        Assert.Equal(
            ItemCondition.VeryGoodPlus,
            Assert.IsType<PresentOptionalValue<ItemCondition>>(item.Holding.Details.Condition).Value);
        Assert.Equal(
            "Shelf A",
            Assert.IsType<PresentOptionalValue<StorageLocation>>(item.Holding.Details.StorageLocation).Value.Name);
    }

    [Fact]
    public void Owned_item_can_update_its_release_without_changing_identity_or_holding()
    {
        var collectionId = CollectionId.New();
        var ownedItemId = OwnedItemId.New();
        var firstReleaseId = ReleaseId.New();
        var secondReleaseId = ReleaseId.New();
        var item = OwnedItem.Create(
            collectionId,
            ownedItemId,
            firstReleaseId,
            OwnershipStatus.Wanted,
            CompactDisc.Create(1));

        item.UpdateRelease(secondReleaseId);

        Assert.Equal(collectionId, item.CollectionId);
        Assert.Equal(ownedItemId, item.Id);
        Assert.Equal(secondReleaseId, item.ReleaseId);
        Assert.Equal(OwnershipStatus.Wanted, item.Holding.Status);
        _ = Assert.IsType<CompactDisc>(item.Holding.Medium);
    }

    [Fact]
    public void Owned_item_types_are_fixed_product_concepts()
    {
        var digital = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, DigitalFile.Create(FilePath.FromAbsolutePath("/music/New Order/Substance"), AudioFileFormat.Flac));
        var vinyl = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, VinylRecord.Create("2xLP"));
        var cd = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, CompactDisc.Create(2));
        var cassette = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, CassetteTape.Create("Chrome"));
        var other = OwnedItem.Create(CollectionId.New(), OwnedItemId.New(), ReleaseId.New(), OwnershipStatus.Owned, OtherMedium.Create("DAT"));

        Assert.Equal(OwnedItemType.Digital, digital.Holding.Medium.Type);
        Assert.Equal("digital", digital.Holding.Medium.Code);
        Assert.Equal(OwnedItemType.Vinyl, vinyl.Holding.Medium.Type);
        Assert.Equal("vinyl", vinyl.Holding.Medium.Code);
        Assert.Equal(OwnedItemType.Cd, cd.Holding.Medium.Type);
        Assert.Equal("cd", cd.Holding.Medium.Code);
        Assert.Equal(OwnedItemType.Cassette, cassette.Holding.Medium.Type);
        Assert.Equal("cassette", cassette.Holding.Medium.Code);
        Assert.Equal(OwnedItemType.Other, other.Holding.Medium.Type);
        Assert.Equal("other", other.Holding.Medium.Code);
    }

    [Fact]
    public void Digital_owned_items_reject_physical_condition_and_storage()
    {
        var item = OwnedItem.Create(
            CollectionId.New(),
            OwnedItemId.New(),
            ReleaseId.New(),
            OwnershipStatus.Owned,
            DigitalFile.Create(FilePath.FromAbsolutePath("/music/New Order/Substance"), AudioFileFormat.Flac));

        DomainException conditionException = Assert.Throws<DomainException>(() => item.WithCondition(ItemCondition.VeryGoodPlus));
        DomainException storageException = Assert.Throws<DomainException>(() => item.WithStorageLocation(StorageLocation.FromName("Shelf A")));

        Assert.Equal("owned_item.physical_details_invalid", conditionException.Code);
        Assert.Equal("owned_item.physical_details_invalid", storageException.Code);
    }

    [Fact]
    public void Physical_owned_items_keep_condition_and_storage()
    {
        OwnedItem item = OwnedItem.Create(
                CollectionId.New(),
                OwnedItemId.New(),
                ReleaseId.New(),
                OwnershipStatus.Owned,
                CassetteTape.Create("Chrome"))
            .WithCondition(ItemCondition.VeryGood)
            .WithStorageLocation(StorageLocation.FromName("Shelf C"));

        Assert.Equal(ItemCondition.VeryGood, Assert.IsType<PresentOptionalValue<ItemCondition>>(item.Holding.Details.Condition).Value);
        Assert.Equal("Shelf C", Assert.IsType<PresentOptionalValue<StorageLocation>>(item.Holding.Details.StorageLocation).Value.Name);
    }

    [Fact]
    public void Owned_item_can_replace_its_medium_without_changing_identity_or_release()
    {
        var collectionId = CollectionId.New();
        var ownedItemId = OwnedItemId.New();
        var releaseId = ReleaseId.New();
        var item = OwnedItem.Create(
            collectionId,
            ownedItemId,
            releaseId,
            OwnershipStatus.Owned,
            VinylRecord.Create("LP"));

        item.UpdateHolding(OwnedItemHolding.Create(OwnershipStatus.NeedsDigitization, CassetteTape.Create("Chrome")));

        Assert.Equal(collectionId, item.CollectionId);
        Assert.Equal(ownedItemId, item.Id);
        Assert.Equal(releaseId, item.ReleaseId);
        Assert.Equal(OwnershipStatus.NeedsDigitization, item.Holding.Status);
        Assert.Equal("Chrome", Assert.IsType<CassetteTape>(item.Holding.Medium).TapeType);
    }

    [Fact]
    public void Owned_item_conditions_are_a_closed_object_catalog()
    {
        Assert.Equal(ItemCondition.Mint, ItemCondition.Mint);
        Assert.NotEqual(ItemCondition.Mint, ItemCondition.Poor);
    }

    [Fact]
    public void Owned_item_rejects_undefined_statuses()
    {
        DomainException createException = Assert.Throws<DomainException>(() =>
            OwnedItem.Create(CollectionId.New(),
                OwnedItemId.New(),
                ReleaseId.New(),
                default,
                VinylRecord.Create("LP")));
        var item = OwnedItem.Create(CollectionId.New(),
            OwnedItemId.New(),
            ReleaseId.New(),
            OwnershipStatus.Owned,
            VinylRecord.Create("LP"));

        DomainException updateException = Assert.Throws<DomainException>(() =>
            item.UpdateHolding(OwnedItemHolding.Create((OwnershipStatus)999, VinylRecord.Create("LP"))));

        Assert.Equal("owned_item.status_invalid", createException.Code);
        Assert.Equal("owned_item.status_invalid", updateException.Code);
    }

    [Fact]
    public void Owned_item_details_validate_required_values()
    {
        Assert.Equal("storage_location.name_required", Assert.Throws<DomainException>(() => StorageLocation.FromName(" ")).Code);
    }

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
