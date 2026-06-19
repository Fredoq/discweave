using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class DigitalTrackFileLinkConfiguration : IEntityTypeConfiguration<DigitalTrackFileLink>
{
    public void Configure(EntityTypeBuilder<DigitalTrackFileLink> builder)
    {
        _ = builder.ToTable("digital_track_file_links");

        _ = builder.Property<long>("id")
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        _ = builder.HasKey("id");

        _ = builder.Property(link => link.Id)
            .HasColumnName("digital_track_file_link_id")
            .HasConversion(PersistenceValueConverters.DigitalTrackFileLinkId)
            .ValueGeneratedNever();

        _ = builder.Property(link => link.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.Property(link => link.DigitalOwnedItemId)
            .HasColumnName("digital_owned_item_id")
            .HasConversion(PersistenceValueConverters.OwnedItemId)
            .ValueGeneratedNever();

        _ = builder.Property(link => link.ReleaseTrackId)
            .HasColumnName("release_track_id")
            .HasConversion(PersistenceValueConverters.ReleaseTrackId)
            .ValueGeneratedNever();

        _ = builder.Property(link => link.LocalAudioFileId)
            .HasColumnName("local_audio_file_id")
            .HasConversion(PersistenceValueConverters.LocalAudioFileId)
            .ValueGeneratedNever();

        _ = builder.HasAlternateKey(link => new { link.CollectionId, link.Id })
            .HasName("ak_digital_track_file_links_collection_link_id");

        _ = builder.HasOne<OwnedItem>()
            .WithMany()
            .HasForeignKey(nameof(DigitalTrackFileLink.CollectionId), nameof(DigitalTrackFileLink.DigitalOwnedItemId))
            .HasPrincipalKey(nameof(OwnedItem.CollectionId), nameof(OwnedItem.Id))
            .OnDelete(DeleteBehavior.Cascade);

        _ = builder.HasOne<ReleaseTrack>()
            .WithMany()
            .HasForeignKey(nameof(DigitalTrackFileLink.CollectionId), nameof(DigitalTrackFileLink.ReleaseTrackId))
            .HasPrincipalKey("CollectionId", nameof(ReleaseTrack.Id))
            .OnDelete(DeleteBehavior.Cascade);

        _ = builder.HasOne<LocalAudioFile>()
            .WithMany()
            .HasForeignKey(nameof(DigitalTrackFileLink.CollectionId), nameof(DigitalTrackFileLink.LocalAudioFileId))
            .HasPrincipalKey(nameof(LocalAudioFile.CollectionId), nameof(LocalAudioFile.Id))
            .OnDelete(DeleteBehavior.Restrict);

        _ = builder.HasIndex(link => new { link.CollectionId, link.DigitalOwnedItemId, link.ReleaseTrackId })
            .IsUnique()
            .HasDatabaseName("ux_digital_track_file_links_collection_owned_item_release_track");
        _ = builder.HasIndex(link => new { link.CollectionId, link.LocalAudioFileId })
            .HasDatabaseName("ix_digital_track_file_links_collection_local_audio_file");
        _ = builder.HasIndex(link => new { link.CollectionId, link.ReleaseTrackId })
            .HasDatabaseName("ix_digital_track_file_links_collection_release_track");
    }
}
