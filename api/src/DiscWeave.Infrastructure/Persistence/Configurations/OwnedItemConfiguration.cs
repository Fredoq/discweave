using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class OwnedItemConfiguration : IEntityTypeConfiguration<OwnedItem>
{
    private const string ReleaseIdProperty = "_releaseId";
    private const string MediumTypeProperty = "_mediumType";
    private const string ConditionProperty = "_condition";
    private const string NoteProperty = "_note";
    private const string StorageLocationProperty = "_storageLocation";
    private const string StatusProperty = "_status";

    public void Configure(EntityTypeBuilder<OwnedItem> builder)
    {
        _ = builder.ToTable(
            "owned_items",
            table => table.HasCheckConstraint(
                "ck_owned_items_physical_details",
                "medium_type <> 'digital' OR (condition IS NULL AND storage_location IS NULL)"));

        _ = builder.Property<long>("id")
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        _ = builder.HasKey("id");

        _ = builder.Property(item => item.Id)
            .HasColumnName("owned_item_id")
            .HasConversion(PersistenceValueConverters.OwnedItemId)
            .ValueGeneratedNever();

        _ = builder.Property(item => item.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.HasAlternateKey(item => new { item.CollectionId, item.Id })
            .HasName("ak_owned_items_collection_owned_item_id");

        _ = builder.Ignore(item => item.Holding);

        _ = builder.Property<ReleaseId>(ReleaseIdProperty)
            .HasColumnName("release_id")
            .HasConversion(PersistenceValueConverters.ReleaseId)
            .ValueGeneratedNever();

        _ = builder.Property<OwnershipStatus>(StatusProperty)
            .HasColumnName("ownership_status")
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        _ = builder.Property<string>(MediumTypeProperty)
            .HasColumnName("medium_type")
            .HasMaxLength(32)
            .IsRequired();

        _ = builder.Property<string>("_vinylFormatDescription")
            .HasColumnName("vinyl_format_description")
            .HasMaxLength(256);

        _ = builder.Property<int?>("_compactDiscCount")
            .HasColumnName("compact_disc_count");

        _ = builder.Property<string>("_cassetteTapeType")
            .HasColumnName("cassette_tape_type")
            .HasMaxLength(256);

        _ = builder.Property<string>("_otherMediumName")
            .HasColumnName("other_medium_name")
            .HasMaxLength(256);

        _ = builder.Property<ItemCondition?>(ConditionProperty)
            .HasColumnName("condition")
            .HasConversion<string>()
            .HasMaxLength(64);

        _ = builder.Property<string>(StorageLocationProperty)
            .HasColumnName("storage_location")
            .HasMaxLength(512);

        _ = builder.Property<string>(NoteProperty)
            .HasColumnName("note")
            .HasMaxLength(2048)
            .HasDefaultValue(string.Empty)
            .IsRequired();

        _ = builder.HasOne<Release>()
            .WithMany()
            .HasForeignKey(nameof(OwnedItem.CollectionId), ReleaseIdProperty)
            .HasPrincipalKey(nameof(Release.CollectionId), nameof(Release.Id))
            .OnDelete(DeleteBehavior.Restrict);

        _ = builder.HasIndex(ReleaseIdProperty);
        _ = builder.HasIndex(item => item.CollectionId);
        _ = builder.HasIndex(MediumTypeProperty);
        _ = builder.HasIndex(StatusProperty);
        _ = builder.HasIndex(nameof(OwnedItem.CollectionId), ConditionProperty)
            .HasDatabaseName("ix_owned_items_collection_condition");
        _ = builder.HasIndex(nameof(OwnedItem.CollectionId), StorageLocationProperty)
            .HasDatabaseName("ix_owned_items_collection_storage_location");
        _ = builder.HasIndex(nameof(OwnedItem.CollectionId), ReleaseIdProperty, MediumTypeProperty)
            .HasDatabaseName("ix_owned_items_inventory_release_medium");
        _ = builder.HasIndex(nameof(OwnedItem.CollectionId), ReleaseIdProperty, StatusProperty)
            .HasDatabaseName("ix_owned_items_inventory_release_status");

        _ = builder.HasOne<MusicCollection>()
            .WithMany()
            .HasForeignKey(item => item.CollectionId)
            .HasPrincipalKey(collection => collection.Id)
            .OnDelete(DeleteBehavior.Cascade);

    }
}
