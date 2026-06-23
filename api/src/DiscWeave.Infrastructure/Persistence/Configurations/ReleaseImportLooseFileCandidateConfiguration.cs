using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class ReleaseImportLooseFileCandidateConfiguration : IEntityTypeConfiguration<ReleaseImportLooseFileCandidate>
{
    private const string CollectionIdProperty = nameof(ReleaseImportLooseFileCandidate.CollectionId);
    private const string SessionIdProperty = nameof(ReleaseImportLooseFileCandidate.SessionId);

    public void Configure(EntityTypeBuilder<ReleaseImportLooseFileCandidate> builder)
    {
        _ = builder.ToTable("release_import_loose_file_candidates");

        _ = builder.Property<long>("id").HasColumnName("id").ValueGeneratedOnAdd();
        _ = builder.HasKey("id");

        _ = builder.Property(candidate => candidate.Id)
            .HasColumnName("release_import_loose_file_candidate_id")
            .HasConversion(PersistenceValueConverters.ReleaseImportLooseFileCandidateId)
            .ValueGeneratedNever();
        _ = builder.Property(candidate => candidate.CollectionId).HasColumnName("collection_id").HasConversion(PersistenceValueConverters.CollectionId).ValueGeneratedNever();
        _ = builder.Property(candidate => candidate.SessionId).HasColumnName("release_import_session_id").HasConversion(PersistenceValueConverters.ReleaseImportSessionId).ValueGeneratedNever();
        _ = builder.Property(candidate => candidate.FilePath).HasColumnName("file_path").HasMaxLength(4096).IsRequired();
        _ = builder.Property(candidate => candidate.RelativePath).HasColumnName("relative_path").HasMaxLength(4096).IsRequired();
        _ = builder.Property(candidate => candidate.Format).HasColumnName("audio_file_format").HasConversion<string>().HasMaxLength(64).IsRequired();
        _ = builder.Property(candidate => candidate.SizeBytes).HasColumnName("size_bytes");
        _ = builder.Property(candidate => candidate.LastModifiedAt).HasColumnName("last_modified_at");
        _ = builder.Property<string>("_contentHash").HasColumnName("content_hash").HasMaxLength(256);
        _ = builder.Property(candidate => candidate.Duration).HasColumnName("duration");
        _ = builder.Property(candidate => candidate.Codec).HasColumnName("codec").HasMaxLength(128);
        _ = builder.Property(candidate => candidate.Quality).HasColumnName("quality").HasConversion<string>().HasMaxLength(64);
        _ = builder.Property(candidate => candidate.BitrateKbps).HasColumnName("bitrate_kbps");
        _ = builder.Property(candidate => candidate.SampleRateHz).HasColumnName("sample_rate_hz");
        _ = builder.Property(candidate => candidate.Channels).HasColumnName("channels");
        _ = builder.Property(candidate => candidate.TitleHint).HasColumnName("title_hint").HasMaxLength(1024);
        _ = builder.Property<string>("_artistHintsJson").HasColumnName("artist_hints_json").HasMaxLength(8192).IsRequired();
        _ = builder.Property(candidate => candidate.AlbumTitleHint).HasColumnName("album_title_hint").HasMaxLength(1024);
        _ = builder.Property<string>("_albumArtistHintsJson").HasColumnName("album_artist_hints_json").HasMaxLength(8192).IsRequired();
        _ = builder.Property(candidate => candidate.TrackNumber).HasColumnName("track_number");
        _ = builder.Property(candidate => candidate.Reason).HasColumnName("reason").HasMaxLength(128).IsRequired();
        _ = builder.Property(candidate => candidate.Decision).HasColumnName("decision").HasMaxLength(64).IsRequired();
        _ = builder.Property(candidate => candidate.SourceDraftId).HasColumnName("source_release_import_draft_id").HasConversion(PersistenceValueConverters.NullableReleaseImportDraftId);
        _ = builder.Property(candidate => candidate.SourceDraftTrackId).HasColumnName("source_release_import_draft_track_id").HasConversion(PersistenceValueConverters.NullableReleaseImportDraftTrackId);
        _ = builder.Property(candidate => candidate.CreatedAt).HasColumnName("created_at");
        _ = builder.Property(candidate => candidate.UpdatedAt).HasColumnName("updated_at");

        _ = builder.Ignore(candidate => candidate.ArtistHints);
        _ = builder.Ignore(candidate => candidate.AlbumArtistHints);
        _ = builder.Ignore(candidate => candidate.ContentHash);

        _ = builder.HasAlternateKey(candidate => candidate.Id).HasName("release_import_loose_file_candidate_id");
        _ = builder.HasAlternateKey(candidate => new { candidate.CollectionId, candidate.Id }).HasName("ak_release_import_loose_file_candidates_collection_candidate_id");
        _ = builder.HasIndex(candidate => new { candidate.CollectionId, candidate.SessionId });
        _ = builder.HasIndex(candidate => new { candidate.CollectionId, candidate.SessionId, candidate.RelativePath }).IsUnique();
        _ = builder.HasIndex(candidate => new { candidate.CollectionId, candidate.Decision });
        _ = builder.HasIndex(candidate => new { candidate.CollectionId, candidate.Reason });

        _ = builder.HasOne<ReleaseImportSession>()
            .WithMany()
            .HasForeignKey(CollectionIdProperty, SessionIdProperty)
            .HasPrincipalKey(nameof(ReleaseImportSession.CollectionId), nameof(ReleaseImportSession.Id))
            .OnDelete(DeleteBehavior.Cascade);

        _ = builder.HasOne<MusicCollection>()
            .WithMany()
            .HasForeignKey(candidate => candidate.CollectionId)
            .HasPrincipalKey(collection => collection.Id)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
