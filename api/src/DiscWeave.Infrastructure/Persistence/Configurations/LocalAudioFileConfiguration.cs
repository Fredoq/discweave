using DiscWeave.Domain.Collection;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class LocalAudioFileConfiguration : IEntityTypeConfiguration<LocalAudioFile>
{
    public void Configure(EntityTypeBuilder<LocalAudioFile> builder)
    {
        _ = builder.ToTable("local_audio_files");

        _ = builder.Property<long>("id")
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        _ = builder.HasKey("id");

        _ = builder.Property(file => file.Id)
            .HasColumnName("local_audio_file_id")
            .HasConversion(PersistenceValueConverters.LocalAudioFileId)
            .ValueGeneratedNever();

        _ = builder.Property(file => file.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.HasAlternateKey(file => new { file.CollectionId, file.Id })
            .HasName("ak_local_audio_files_collection_local_audio_file_id");

        _ = builder.Property(file => file.Path)
            .HasColumnName("path")
            .HasConversion(path => path.Value, value => FilePath.FromAbsolutePath(value))
            .HasMaxLength(4096)
            .IsRequired();

        _ = builder.Property(file => file.Format)
            .HasColumnName("format")
            .HasConversion(PersistenceValueConverters.OptionalAudioFileFormat)
            .HasMaxLength(64)
            .IsRequired(false);
        builder.Property(file => file.Format).Metadata.SetValueComparer(PersistenceValueConverters.OptionalAudioFileFormatComparer);

        _ = builder.Property(file => file.Codec)
            .HasColumnName("codec")
            .HasConversion(PersistenceValueConverters.OptionalString)
            .HasMaxLength(128)
            .IsRequired(false);
        builder.Property(file => file.Codec).Metadata.SetValueComparer(PersistenceValueConverters.OptionalStringComparer);

        _ = builder.Property(file => file.Quality)
            .HasColumnName("quality")
            .HasConversion(PersistenceValueConverters.OptionalAudioFileQuality)
            .HasMaxLength(64)
            .IsRequired(false);
        builder.Property(file => file.Quality).Metadata.SetValueComparer(PersistenceValueConverters.OptionalAudioFileQualityComparer);

        _ = builder.Property(file => file.SizeBytes)
            .HasColumnName("size_bytes")
            .HasConversion(PersistenceValueConverters.OptionalLong)
            .IsRequired(false);
        builder.Property(file => file.SizeBytes).Metadata.SetValueComparer(PersistenceValueConverters.OptionalLongComparer);

        _ = builder.Property(file => file.ModifiedAt)
            .HasColumnName("modified_at")
            .HasConversion(PersistenceValueConverters.OptionalDateTimeOffset)
            .IsRequired(false);
        builder.Property(file => file.ModifiedAt).Metadata.SetValueComparer(PersistenceValueConverters.OptionalDateTimeOffsetComparer);

        _ = builder.Property(file => file.ContentHash)
            .HasColumnName("content_hash")
            .HasConversion(PersistenceValueConverters.OptionalString)
            .HasMaxLength(256)
            .IsRequired(false);
        builder.Property(file => file.ContentHash).Metadata.SetValueComparer(PersistenceValueConverters.OptionalStringComparer);

        _ = builder.Property(file => file.Duration)
            .HasColumnName("duration_ticks")
            .HasConversion(PersistenceValueConverters.OptionalTimeSpanTicks)
            .IsRequired(false);
        builder.Property(file => file.Duration).Metadata.SetValueComparer(PersistenceValueConverters.OptionalTimeSpanComparer);

        _ = builder.Property(file => file.BitrateKbps)
            .HasColumnName("bitrate_kbps")
            .HasConversion(PersistenceValueConverters.OptionalInt)
            .IsRequired(false);
        builder.Property(file => file.BitrateKbps).Metadata.SetValueComparer(PersistenceValueConverters.OptionalIntComparer);

        _ = builder.Property(file => file.SampleRateHz)
            .HasColumnName("sample_rate_hz")
            .HasConversion(PersistenceValueConverters.OptionalInt)
            .IsRequired(false);
        builder.Property(file => file.SampleRateHz).Metadata.SetValueComparer(PersistenceValueConverters.OptionalIntComparer);

        _ = builder.Property(file => file.Channels)
            .HasColumnName("channels")
            .HasConversion(PersistenceValueConverters.OptionalInt)
            .IsRequired(false);
        builder.Property(file => file.Channels).Metadata.SetValueComparer(PersistenceValueConverters.OptionalIntComparer);

        _ = builder.Ignore(file => file.ImportIdentity);
        _ = builder.Property<string>("_importIdentityPath")
            .HasColumnName("import_identity_path")
            .HasMaxLength(4096);
        _ = builder.Property<long?>("_importIdentitySizeBytes")
            .HasColumnName("import_identity_size_bytes");
        _ = builder.Property<DateTimeOffset?>("_importIdentityLastModifiedAt")
            .HasColumnName("import_identity_last_modified_at");
        _ = builder.Property<string>("_importIdentityContentHash")
            .HasColumnName("import_identity_content_hash")
            .HasMaxLength(256);

        _ = builder.HasOne<MusicCollection>()
            .WithMany()
            .HasForeignKey(file => file.CollectionId)
            .HasPrincipalKey(collection => collection.Id)
            .OnDelete(DeleteBehavior.Cascade);

        _ = builder.HasIndex(file => new { file.CollectionId, file.Path })
            .IsUnique()
            .HasDatabaseName("ux_local_audio_files_collection_path");
        _ = builder.HasIndex(file => new { file.CollectionId, file.ContentHash })
            .HasDatabaseName("ix_local_audio_files_collection_content_hash");
        _ = builder.HasIndex(
                nameof(LocalAudioFile.CollectionId),
                "_importIdentityPath",
                "_importIdentitySizeBytes",
                "_importIdentityLastModifiedAt",
                "_importIdentityContentHash")
            .HasDatabaseName("ix_local_audio_files_import_identity");
    }
}
