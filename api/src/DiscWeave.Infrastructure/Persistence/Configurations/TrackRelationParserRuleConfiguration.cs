using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Settings;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class TrackRelationParserRuleConfiguration : IEntityTypeConfiguration<TrackRelationParserRule>
{
    public void Configure(EntityTypeBuilder<TrackRelationParserRule> builder)
    {
        _ = builder.ToTable("track_relation_parser_rules");

        _ = builder.Property<long>("id").HasColumnName("id").ValueGeneratedOnAdd();
        _ = builder.HasKey("id");

        _ = builder.Property(rule => rule.Id)
            .HasColumnName("track_relation_parser_rule_id")
            .HasConversion(PersistenceValueConverters.TrackRelationParserRuleId)
            .ValueGeneratedNever();

        _ = builder.Property(rule => rule.CollectionId)
            .HasColumnName("collection_id")
            .HasConversion(PersistenceValueConverters.CollectionId)
            .ValueGeneratedNever();

        _ = builder.Property(rule => rule.RelationTypeCode)
            .HasColumnName("relation_type_code")
            .HasMaxLength(64)
            .IsRequired();

        _ = builder.Property(rule => rule.Alias)
            .HasColumnName("alias")
            .HasMaxLength(128)
            .IsRequired();

        _ = builder.Property(rule => rule.MatchMode)
            .HasColumnName("match_mode")
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        _ = builder.Property(rule => rule.Confidence).HasColumnName("confidence");

        _ = builder.Property(rule => rule.Direction)
            .HasColumnName("direction")
            .HasConversion<string>()
            .HasMaxLength(64)
            .IsRequired();

        _ = builder.Property(rule => rule.SortOrder).HasColumnName("sort_order");
        _ = builder.Property(rule => rule.IsActive).HasColumnName("is_active");
        _ = builder.Property(rule => rule.IsBuiltin).HasColumnName("is_builtin");

        _ = builder.HasAlternateKey(rule => new { rule.CollectionId, rule.Id })
            .HasName("ak_track_relation_parser_rules_collection_rule_id");
        _ = builder.HasIndex(rule => new { rule.CollectionId, rule.SortOrder });
        _ = builder.HasIndex(rule => new { rule.CollectionId, rule.RelationTypeCode, rule.Alias, rule.MatchMode })
            .IsUnique()
            .HasDatabaseName("ux_track_relation_parser_rules_collection_type_alias_mode");

        _ = builder.HasOne<MusicCollection>()
            .WithMany()
            .HasForeignKey(rule => rule.CollectionId)
            .HasPrincipalKey(collection => collection.Id)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
