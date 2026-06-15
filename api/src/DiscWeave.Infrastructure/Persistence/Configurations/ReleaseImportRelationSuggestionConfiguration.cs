using DiscWeave.Domain.Imports;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class ReleaseImportRelationSuggestionConfiguration : IEntityTypeConfiguration<ReleaseImportRelationSuggestion>
{
    public void Configure(EntityTypeBuilder<ReleaseImportRelationSuggestion> builder)
    {
        _ = builder.ToTable("release_import_relation_suggestions");

        _ = builder.Property<long>("id").HasColumnName("id").ValueGeneratedOnAdd();
        _ = builder.HasKey("id");

        _ = builder.Property(suggestion => suggestion.Id)
            .HasColumnName("release_import_relation_suggestion_id")
            .HasConversion(PersistenceValueConverters.ReleaseImportRelationSuggestionId)
            .ValueGeneratedNever();

        _ = builder.Property(suggestion => suggestion.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.Property(suggestion => suggestion.SessionId)
            .HasColumnName("release_import_session_id")
            .HasConversion(PersistenceValueConverters.ReleaseImportSessionId)
            .ValueGeneratedNever();

        _ = builder.Property(suggestion => suggestion.DraftId)
            .HasColumnName("release_import_draft_id")
            .HasConversion(PersistenceValueConverters.ReleaseImportDraftId)
            .ValueGeneratedNever();

        _ = builder.Property(suggestion => suggestion.Token).HasColumnName("token").HasMaxLength(512).IsRequired();
        _ = builder.Property(suggestion => suggestion.Confidence).HasColumnName("confidence");
        _ = builder.Property(suggestion => suggestion.Decision).HasColumnName("decision").HasConversion<string>().HasMaxLength(64).IsRequired();
        _ = builder.Property<string>("_suggestedPayloadJson").HasColumnName("suggested_payload_json").HasMaxLength(8192).IsRequired();
        _ = builder.Property<string>("_reviewedPayloadJson").HasColumnName("reviewed_payload_json").HasMaxLength(8192).IsRequired();

        _ = builder.Ignore(suggestion => suggestion.SuggestedPayload);
        _ = builder.Ignore(suggestion => suggestion.ReviewedPayload);

        _ = builder.HasAlternateKey(suggestion => suggestion.Id).HasName("release_import_relation_suggestion_id");
        _ = builder.HasAlternateKey(suggestion => new { suggestion.CollectionId, suggestion.Id })
            .HasName("ak_release_import_relation_suggestions_collection_suggestion_id");
        _ = builder.HasIndex(suggestion => new { suggestion.CollectionId, suggestion.SessionId });
        _ = builder.HasIndex(suggestion => new { suggestion.CollectionId, suggestion.DraftId });

        _ = builder.HasOne<ReleaseImportDraft>()
            .WithMany()
            .HasForeignKey(suggestion => new { suggestion.CollectionId, suggestion.DraftId })
            .HasPrincipalKey(draft => new { draft.CollectionId, draft.Id })
            .OnDelete(DeleteBehavior.Cascade);
    }
}
