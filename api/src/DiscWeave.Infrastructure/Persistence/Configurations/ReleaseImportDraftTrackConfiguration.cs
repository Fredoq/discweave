using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Optional;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class ReleaseImportDraftTrackConfiguration : IEntityTypeConfiguration<ReleaseImportDraftTrack>
{
    private static readonly ValueConverter<IOptionalValue<AudioFileQuality>, string?> OptionalAudioFileQuality = new(
        value => OptionalAudioFileQualityCode(value),
        value => OptionalAudioFileQualityValue(value));

    public void Configure(EntityTypeBuilder<ReleaseImportDraftTrack> builder)
    {
        _ = builder.ToTable("release_import_draft_tracks");

        _ = builder.Property<long>("id").HasColumnName("id").ValueGeneratedOnAdd();
        _ = builder.HasKey("id");

        _ = builder.Property(track => track.Id).HasColumnName("release_import_draft_track_id").HasConversion(PersistenceValueConverters.ReleaseImportDraftTrackId).ValueGeneratedNever();
        _ = builder.Property(track => track.CollectionId).HasColumnName("collection_id").HasConversion(PersistenceValueConverters.CollectionId).ValueGeneratedNever();
        _ = builder.Property(track => track.DraftId).HasColumnName("release_import_draft_id").HasConversion(PersistenceValueConverters.ReleaseImportDraftId).ValueGeneratedNever();
        _ = builder.Property(track => track.SourceKind)
            .HasColumnName("source_kind")
            .HasConversion<string>()
            .HasMaxLength(64)
            .HasDefaultValue(ReleaseImportSourceKind.LocalFiles)
            .ValueGeneratedNever()
            .IsRequired();
        _ = builder.Property(track => track.Duration).HasColumnName("duration");
        _ = builder.Property(track => track.Position).HasColumnName("position_number");
        _ = builder.Property(track => track.Disc).HasColumnName("disc").HasMaxLength(64);
        _ = builder.Property(track => track.Side).HasColumnName("side").HasMaxLength(64);
        _ = builder.Property(track => track.Title).HasColumnName("title").HasMaxLength(1024).IsRequired();
        _ = builder.Property(track => track.VersionYear).HasColumnName("version_year");
        _ = builder.Property(track => track.InheritReleaseArtistCredits).HasColumnName("inherit_release_artist_credits");
        _ = builder.Property(track => track.IsSkipped).HasColumnName("is_skipped");
        _ = builder.Property(track => track.TrackMode).HasColumnName("track_mode").HasConversion<string>().HasMaxLength(64);
        _ = builder.Property(track => track.SelectedTrackId).HasColumnName("selected_track_id").HasConversion(PersistenceValueConverters.NullableTrackId);
        _ = builder.Property<string>("_artistCreditsJson").HasColumnName("artist_credits_json").HasMaxLength(8192);
        _ = builder.Property<string>("_artistNamesJson").HasColumnName("artist_names_json").HasMaxLength(8192);
        _ = builder.Property<string>("_selectedArtistIdsJson").HasColumnName("selected_artist_ids_json").HasMaxLength(8192);
        _ = builder.Property<string>("_issuesJson").HasColumnName("issues_json").HasMaxLength(8192);

        _ = builder.Ignore(track => track.ArtistCredits);
        _ = builder.Ignore(track => track.ArtistNames);
        _ = builder.Ignore(track => track.SelectedArtistIds);
        _ = builder.Ignore(track => track.Issues);
        _ = builder.Ignore(track => track.LocalFile);

        _ = builder.OwnsOne<ReleaseImportLocalFileDescriptor>("_localFile", localFile =>
        {
            _ = localFile.Property(file => file.FilePath).HasColumnName("file_path").HasMaxLength(4096);
            _ = localFile.Property(file => file.RelativePath).HasColumnName("relative_path").HasMaxLength(4096);
            _ = localFile.Property(file => file.Format).HasColumnName("audio_file_format").HasConversion<string>().HasMaxLength(64);
            _ = localFile.Property(file => file.SizeBytes).HasColumnName("size_bytes");
            _ = localFile.Property(file => file.LastModifiedAt).HasColumnName("last_modified_at");
            _ = localFile.Property(file => file.ContentHash)
                .HasColumnName("content_hash")
                .HasConversion(PersistenceValueConverters.OptionalString)
                .HasMaxLength(256)
                .IsRequired(false);
            _ = localFile.Property(file => file.Codec)
                .HasColumnName("codec")
                .HasConversion(PersistenceValueConverters.OptionalString)
                .HasMaxLength(128)
                .IsRequired(false);
            _ = localFile.Property(file => file.Quality)
                .HasColumnName("quality")
                .HasConversion(OptionalAudioFileQuality)
                .HasMaxLength(64)
                .IsRequired(false);
            _ = localFile.Property(file => file.BitrateKbps)
                .HasColumnName("bitrate_kbps")
                .HasConversion(PersistenceValueConverters.OptionalInt)
                .IsRequired(false);
            _ = localFile.Property(file => file.SampleRateHz)
                .HasColumnName("sample_rate_hz")
                .HasConversion(PersistenceValueConverters.OptionalInt)
                .IsRequired(false);
            _ = localFile.Property(file => file.Channels)
                .HasColumnName("channels")
                .HasConversion(PersistenceValueConverters.OptionalInt)
                .IsRequired(false);
        });

        _ = builder.HasAlternateKey(track => track.Id).HasName("release_import_draft_track_id");
        _ = builder.HasAlternateKey(track => new { track.CollectionId, track.Id })
            .HasName("ak_release_import_draft_tracks_collection_track_id");
        _ = builder.HasAlternateKey(track => new { track.CollectionId, track.DraftId, track.Id })
            .HasName("ak_release_import_draft_tracks_collection_draft_track_id");
        _ = builder.HasIndex(track => track.CollectionId);
        _ = builder.HasIndex(track => track.DraftId);

        _ = builder.HasOne<ReleaseImportDraft>()
            .WithMany()
            .HasForeignKey(track => new { track.CollectionId, track.DraftId, track.SourceKind })
            .HasPrincipalKey(draft => new { draft.CollectionId, draft.Id, draft.SourceKind })
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static string? OptionalAudioFileQualityCode(IOptionalValue<AudioFileQuality> quality)
    {
        return quality is PresentOptionalValue<AudioFileQuality> present ? present.Value.ToString() : null;
    }

    private static IOptionalValue<AudioFileQuality> OptionalAudioFileQualityValue(string? quality)
    {
        return quality is null
            ? Optional.Missing<AudioFileQuality>()
            : Optional.From(Enum.Parse<AudioFileQuality>(quality));
    }
}
