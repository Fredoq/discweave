using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Review;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class CollectionReviewIssueStateConfiguration : IEntityTypeConfiguration<CollectionReviewIssueState>
{
    public void Configure(EntityTypeBuilder<CollectionReviewIssueState> builder)
    {
        _ = builder.ToTable("collection_review_issue_states");

        _ = builder.Property<long>("id").HasColumnName("id").ValueGeneratedOnAdd();
        _ = builder.HasKey("id");

        _ = builder.Property(state => state.Id)
            .HasColumnName("collection_review_issue_state_id")
            .HasConversion(PersistenceValueConverters.CollectionReviewIssueStateId)
            .ValueGeneratedNever();

        _ = builder.Property(state => state.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.Property(state => state.StableKey)
            .HasColumnName("stable_key")
            .HasMaxLength(64)
            .IsRequired();

        _ = builder.Property(state => state.Category)
            .HasColumnName("category")
            .HasMaxLength(64)
            .IsRequired();

        _ = builder.Property(state => state.Subtype)
            .HasColumnName("subtype")
            .HasMaxLength(128)
            .IsRequired();

        _ = builder.Property(state => state.Title)
            .HasColumnName("title")
            .HasMaxLength(512)
            .IsRequired();

        _ = builder.Property(state => state.SourceDetector)
            .HasColumnName("source_detector")
            .HasMaxLength(128)
            .IsRequired();

        _ = builder.Property(state => state.TargetsJson)
            .HasColumnName("targets_json")
            .HasMaxLength(8192)
            .IsRequired();

        _ = builder.Property(state => state.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        _ = builder.Property(state => state.Reason)
            .HasColumnName("reason")
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        _ = builder.Property(state => state.CreatedAt).HasColumnName("created_at");
        _ = builder.Property(state => state.UpdatedAt).HasColumnName("updated_at");
        _ = builder.Property(state => state.LastSeenAt).HasColumnName("last_seen_at");
        _ = builder.Property(state => state.ResolvedAt).HasColumnName("resolved_at");
        _ = builder.Property(state => state.Note).HasColumnName("note").HasMaxLength(2048);

        _ = builder.HasAlternateKey(state => new { state.CollectionId, state.Id })
            .HasName("ak_collection_review_issue_states_collection_state_id");
        _ = builder.HasIndex(state => new { state.CollectionId, state.StableKey })
            .IsUnique()
            .HasDatabaseName("ux_collection_review_issue_states_collection_stable_key");
        _ = builder.HasIndex(state => new { state.CollectionId, state.Category });
        _ = builder.HasIndex(state => new { state.CollectionId, state.Status });
        _ = builder.HasIndex(state => new { state.CollectionId, state.Category, state.Status });

        _ = builder.HasOne<MusicCollection>()
            .WithMany()
            .HasForeignKey(state => state.CollectionId)
            .HasPrincipalKey(collection => collection.Id)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
