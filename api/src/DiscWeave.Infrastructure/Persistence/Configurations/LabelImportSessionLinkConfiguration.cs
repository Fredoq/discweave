using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class LabelImportSessionLinkConfiguration : IEntityTypeConfiguration<LabelImportSessionLink>
{
    public void Configure(EntityTypeBuilder<LabelImportSessionLink> builder)
    {
        _ = builder.ToTable("label_import_session_links", table =>
            table.HasCheckConstraint("ck_label_import_local_files", "source_kind = 'LocalFiles'"));
        _ = builder.HasKey(link => new { link.CollectionId, link.LabelId, link.SessionId });
        _ = builder.Property(link => link.CollectionId).HasColumnName("collection_id").HasConversion(PersistenceValueConverters.CollectionId).ValueGeneratedNever();
        _ = builder.Property(link => link.LabelId).HasColumnName("label_id").HasConversion(PersistenceValueConverters.LabelId).ValueGeneratedNever();
        _ = builder.Property(link => link.SessionId).HasColumnName("session_id").HasConversion(PersistenceValueConverters.ReleaseImportSessionId).ValueGeneratedNever();
        _ = builder.Property(link => link.SourceKind).HasColumnName("source_kind").HasConversion<string>().HasMaxLength(64).IsRequired();
        _ = builder.HasOne<Label>().WithMany()
            .HasForeignKey(link => new { link.CollectionId, link.LabelId })
            .HasPrincipalKey(label => new { label.CollectionId, label.Id })
            .OnDelete(DeleteBehavior.Cascade);
        _ = builder.HasOne<ReleaseImportSession>().WithMany()
            .HasForeignKey(link => new { link.CollectionId, link.SessionId, link.SourceKind })
            .HasPrincipalKey(session => new { session.CollectionId, session.Id, session.SourceKind })
            .OnDelete(DeleteBehavior.Cascade);
        _ = builder.HasIndex(link => new { link.CollectionId, link.SessionId, link.SourceKind });
    }
}
