using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class ReleaseImportScanDiagnosticConfiguration : IEntityTypeConfiguration<ReleaseImportScanDiagnostic>
{
    private const string CollectionIdProperty = nameof(ReleaseImportScanDiagnostic.CollectionId);
    private const string SessionIdProperty = nameof(ReleaseImportScanDiagnostic.SessionId);

    public void Configure(EntityTypeBuilder<ReleaseImportScanDiagnostic> builder)
    {
        _ = builder.ToTable("release_import_scan_diagnostics");

        _ = builder.Property<long>("id").HasColumnName("id").ValueGeneratedOnAdd();
        _ = builder.HasKey("id");

        _ = builder.Property(diagnostic => diagnostic.Id)
            .HasColumnName("release_import_scan_diagnostic_id")
            .HasConversion(PersistenceValueConverters.ReleaseImportScanDiagnosticId)
            .ValueGeneratedNever();

        _ = builder.Property(diagnostic => diagnostic.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.Property(diagnostic => diagnostic.SessionId)
            .HasColumnName("release_import_session_id")
            .HasConversion(PersistenceValueConverters.ReleaseImportSessionId)
            .ValueGeneratedNever();

        _ = builder.Property(diagnostic => diagnostic.Code).HasColumnName("code").HasMaxLength(128).IsRequired();
        _ = builder.Property(diagnostic => diagnostic.Severity).HasColumnName("severity").HasConversion<string>().HasMaxLength(32).IsRequired();
        _ = builder.Property(diagnostic => diagnostic.Message).HasColumnName("message").HasMaxLength(1024).IsRequired();
        _ = builder.Property(diagnostic => diagnostic.FilePath).HasColumnName("file_path").HasMaxLength(4096).IsRequired();
        _ = builder.Property(diagnostic => diagnostic.RelativePath).HasColumnName("relative_path").HasMaxLength(4096).IsRequired();
        _ = builder.Property(diagnostic => diagnostic.Extension).HasColumnName("extension").HasMaxLength(32);
        _ = builder.Property(diagnostic => diagnostic.SizeBytes).HasColumnName("size_bytes");
        _ = builder.Property(diagnostic => diagnostic.Source).HasColumnName("source").HasMaxLength(64).IsRequired();
        _ = builder.Property(diagnostic => diagnostic.CreatedAt).HasColumnName("created_at");

        _ = builder.HasAlternateKey(diagnostic => diagnostic.Id).HasName("release_import_scan_diagnostic_id");
        _ = builder.HasAlternateKey(diagnostic => new { diagnostic.CollectionId, diagnostic.Id })
            .HasName("ak_release_import_scan_diagnostics_collection_diagnostic_id");
        _ = builder.HasIndex(diagnostic => new { diagnostic.CollectionId, diagnostic.SessionId });
        _ = builder.HasIndex(diagnostic => new { diagnostic.CollectionId, diagnostic.Code });
        _ = builder.HasIndex(diagnostic => new { diagnostic.CollectionId, diagnostic.Severity });

        _ = builder.HasOne<ReleaseImportSession>()
            .WithMany()
            .HasForeignKey(CollectionIdProperty, SessionIdProperty)
            .HasPrincipalKey(nameof(ReleaseImportSession.CollectionId), nameof(ReleaseImportSession.Id))
            .OnDelete(DeleteBehavior.Cascade);

        _ = builder.HasOne<MusicCollection>()
            .WithMany()
            .HasForeignKey(diagnostic => diagnostic.CollectionId)
            .HasPrincipalKey(collection => collection.Id)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
