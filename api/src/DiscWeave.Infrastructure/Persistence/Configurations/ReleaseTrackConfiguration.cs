using DiscWeave.Domain.Catalog;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class ReleaseTrackConfiguration : IEntityTypeConfiguration<ReleaseTrack>
{
    public void Configure(EntityTypeBuilder<ReleaseTrack> builder)
    {
        const string CollectionIdProperty = nameof(ReleaseTrack.CollectionId);
        const string ReleaseIdProperty = nameof(ReleaseTrack.ReleaseId);

        _ = builder.ToTable("release_tracks");

        _ = builder.Property<long>("id")
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        _ = builder.HasKey("id")
            .HasName("pk_release_tracks");

        _ = builder.Property(track => track.Id)
            .HasColumnName("release_track_id")
            .HasConversion(PersistenceValueConverters.ReleaseTrackId)
            .ValueGeneratedNever();

        _ = builder.Property(track => track.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.Property(track => track.ReleaseId)
            .HasColumnName("release_id")
            .HasConversion(PersistenceValueConverters.ReleaseId)
            .ValueGeneratedNever();

        _ = builder.HasAlternateKey(track => new { track.CollectionId, track.Id })
            .HasName("ak_release_tracks_collection_release_track_id");

        _ = builder.Property(track => track.TrackId)
            .HasColumnName("track_id")
            .HasConversion(PersistenceValueConverters.TrackId);

        _ = builder.OwnsOne(track => track.Position, position =>
        {
            _ = position.Property(value => value.Number)
                .HasColumnName("position_number");

            PropertyBuilder discProperty = position.Property(value => value.Disc)
                .HasColumnName("position_disc")
                .HasMaxLength(64)
                .HasConversion(PersistenceValueConverters.OptionalString)
                .IsRequired(false);
            discProperty.Metadata.SetValueComparer(PersistenceValueConverters.OptionalStringComparer);

            PropertyBuilder sideProperty = position.Property(value => value.Side)
                .HasColumnName("position_side")
                .HasMaxLength(64)
                .HasConversion(PersistenceValueConverters.OptionalString)
                .IsRequired(false);
            sideProperty.Metadata.SetValueComparer(PersistenceValueConverters.OptionalStringComparer);
        });

        PropertyBuilder titleOverrideProperty = builder.Property(track => track.TitleOverride)
            .HasColumnName("title_override")
            .HasMaxLength(1024)
            .HasConversion(PersistenceValueConverters.OptionalString)
            .IsRequired(false);
        titleOverrideProperty.Metadata.SetValueComparer(PersistenceValueConverters.OptionalStringComparer);

        _ = builder.HasOne<Release>()
            .WithMany(release => release.Tracklist)
            .HasForeignKey(track => new { track.CollectionId, track.ReleaseId })
            .HasPrincipalKey(release => new { release.CollectionId, release.Id })
            .OnDelete(DeleteBehavior.Cascade);

        _ = builder.HasOne<Track>()
            .WithMany()
            .HasForeignKey(CollectionIdProperty, nameof(ReleaseTrack.TrackId))
            .HasPrincipalKey(track => new { track.CollectionId, track.Id })
            .OnDelete(DeleteBehavior.Restrict);

        _ = builder.HasIndex(ReleaseIdProperty);
        _ = builder.HasIndex(track => track.TrackId);
        _ = builder.HasIndex(CollectionIdProperty);
        _ = builder.HasIndex(track => new { track.CollectionId, track.Id })
            .IsUnique()
            .HasDatabaseName("ix_release_tracks_collection_release_track_id");
    }
}
