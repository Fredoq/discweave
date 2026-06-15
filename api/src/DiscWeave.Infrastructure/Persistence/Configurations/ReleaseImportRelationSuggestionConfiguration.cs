using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class ReleaseImportRelationSuggestionConfiguration : IEntityTypeConfiguration<ReleaseImportRelationSuggestion>
{
    private const string CollectionIdProperty = nameof(ReleaseImportRelationSuggestion.CollectionId);
    private const string DraftIdProperty = nameof(ReleaseImportRelationSuggestion.DraftId);
    private const string SessionIdProperty = nameof(ReleaseImportRelationSuggestion.SessionId);

    public void Configure(EntityTypeBuilder<ReleaseImportRelationSuggestion> builder)
    {
        _ = builder.ToTable(
            "release_import_relation_suggestions",
            table =>
            {
                _ = table.HasCheckConstraint(
                    "ck_release_import_relation_suggestions_suggested_source_kind",
                    "suggested_source_kind = 'DraftTrack'");
                _ = table.HasCheckConstraint(
                    "ck_release_import_relation_suggestions_reviewed_source_kind",
                    "reviewed_source_kind = 'DraftTrack'");
                _ = table.HasCheckConstraint(
                    "ck_release_import_relation_suggestions_suggested_target_consistency",
                    "(suggested_target_kind IS NULL AND suggested_target_track_id IS NULL AND suggested_target_draft_track_id IS NULL AND suggested_target_existing_track_id IS NULL) OR " +
                    "(suggested_target_kind = 'DraftTrack' AND suggested_target_track_id IS NOT NULL AND suggested_target_draft_track_id = suggested_target_track_id AND suggested_target_existing_track_id IS NULL) OR " +
                    "(suggested_target_kind = 'ExistingTrack' AND suggested_target_track_id IS NOT NULL AND suggested_target_existing_track_id = suggested_target_track_id AND suggested_target_draft_track_id IS NULL)");
                _ = table.HasCheckConstraint(
                    "ck_release_import_relation_suggestions_reviewed_target_consistency",
                    "(reviewed_target_kind IS NULL AND reviewed_target_track_id IS NULL AND reviewed_target_draft_track_id IS NULL AND reviewed_target_existing_track_id IS NULL) OR " +
                    "(reviewed_target_kind = 'DraftTrack' AND reviewed_target_track_id IS NOT NULL AND reviewed_target_draft_track_id = reviewed_target_track_id AND reviewed_target_existing_track_id IS NULL) OR " +
                    "(reviewed_target_kind = 'ExistingTrack' AND reviewed_target_track_id IS NOT NULL AND reviewed_target_existing_track_id = reviewed_target_track_id AND reviewed_target_draft_track_id IS NULL)");
            });

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
        _ = builder.Property<string>("_suggestedSourceKind").HasColumnName("suggested_source_kind").HasMaxLength(32).IsRequired();
        _ = builder.Property<ReleaseImportDraftTrackId>("_suggestedSourceTrackId")
            .HasColumnName("suggested_source_track_id")
            .HasConversion(PersistenceValueConverters.ReleaseImportDraftTrackId)
            .IsRequired();
        _ = builder.Property<string>("_suggestedTargetKind").HasColumnName("suggested_target_kind").HasMaxLength(32);
        _ = builder.Property<Guid?>("_suggestedTargetTrackId").HasColumnName("suggested_target_track_id");
        _ = builder.Property<ReleaseImportDraftTrackId?>("_suggestedTargetDraftTrackId")
            .HasColumnName("suggested_target_draft_track_id")
            .HasConversion(PersistenceValueConverters.NullableReleaseImportDraftTrackId);
        _ = builder.Property<TrackId?>("_suggestedTargetExistingTrackId")
            .HasColumnName("suggested_target_existing_track_id")
            .HasConversion(PersistenceValueConverters.NullableTrackId);
        _ = builder.Property<string>("_suggestedRelationTypeCode").HasColumnName("suggested_relation_type_code").HasMaxLength(64).IsRequired();
        _ = builder.Property<string>("_reviewedSourceKind").HasColumnName("reviewed_source_kind").HasMaxLength(32).IsRequired();
        _ = builder.Property<ReleaseImportDraftTrackId>("_reviewedSourceTrackId")
            .HasColumnName("reviewed_source_track_id")
            .HasConversion(PersistenceValueConverters.ReleaseImportDraftTrackId)
            .IsRequired();
        _ = builder.Property<string>("_reviewedTargetKind").HasColumnName("reviewed_target_kind").HasMaxLength(32);
        _ = builder.Property<Guid?>("_reviewedTargetTrackId").HasColumnName("reviewed_target_track_id");
        _ = builder.Property<ReleaseImportDraftTrackId?>("_reviewedTargetDraftTrackId")
            .HasColumnName("reviewed_target_draft_track_id")
            .HasConversion(PersistenceValueConverters.NullableReleaseImportDraftTrackId);
        _ = builder.Property<TrackId?>("_reviewedTargetExistingTrackId")
            .HasColumnName("reviewed_target_existing_track_id")
            .HasConversion(PersistenceValueConverters.NullableTrackId);
        _ = builder.Property<string>("_reviewedRelationTypeCode").HasColumnName("reviewed_relation_type_code").HasMaxLength(64).IsRequired();
        _ = builder.Property<string>("_suggestedPayloadJson").HasColumnName("suggested_payload_json").HasMaxLength(8192).IsRequired();
        _ = builder.Property<string>("_reviewedPayloadJson").HasColumnName("reviewed_payload_json").HasMaxLength(8192).IsRequired();

        _ = builder.Ignore(suggestion => suggestion.SuggestedPayload);
        _ = builder.Ignore(suggestion => suggestion.ReviewedPayload);

        _ = builder.HasAlternateKey(suggestion => suggestion.Id).HasName("release_import_relation_suggestion_id");
        _ = builder.HasAlternateKey(suggestion => new { suggestion.CollectionId, suggestion.Id })
            .HasName("ak_release_import_relation_suggestions_collection_suggestion_id");
        _ = builder.HasIndex(suggestion => new { suggestion.CollectionId, suggestion.SessionId });
        _ = builder.HasIndex(suggestion => new { suggestion.CollectionId, suggestion.DraftId });
        _ = builder.HasIndex(CollectionIdProperty, "_suggestedSourceTrackId")
            .HasDatabaseName("IX_release_import_relation_suggestions_collection_id_suggested_source_track_id");
        _ = builder.HasIndex(CollectionIdProperty, "_suggestedTargetTrackId")
            .HasDatabaseName("IX_release_import_relation_suggestions_collection_id_suggested_target_track_id");
        _ = builder.HasIndex(CollectionIdProperty, "_reviewedSourceTrackId")
            .HasDatabaseName("IX_release_import_relation_suggestions_collection_id_reviewed_source_track_id");
        _ = builder.HasIndex(CollectionIdProperty, "_reviewedTargetTrackId")
            .HasDatabaseName("IX_release_import_relation_suggestions_collection_id_reviewed_target_track_id");

        _ = builder.HasOne<ReleaseImportDraft>()
            .WithMany()
            .HasForeignKey(CollectionIdProperty, SessionIdProperty, DraftIdProperty)
            .HasPrincipalKey(nameof(ReleaseImportDraft.CollectionId), nameof(ReleaseImportDraft.SessionId), nameof(ReleaseImportDraft.Id))
            .OnDelete(DeleteBehavior.Cascade);

        ConfigureDraftTrackReference(builder, "_suggestedSourceTrackId");
        ConfigureDraftTrackReference(builder, "_reviewedSourceTrackId");
        ConfigureTargetDraftTrackReference(builder, "_suggestedTargetDraftTrackId");
        ConfigureTargetDraftTrackReference(builder, "_reviewedTargetDraftTrackId");
        ConfigureExistingTrackReference(builder, "_suggestedTargetExistingTrackId");
        ConfigureExistingTrackReference(builder, "_reviewedTargetExistingTrackId");
    }

    private static void ConfigureDraftTrackReference(EntityTypeBuilder<ReleaseImportRelationSuggestion> builder, string trackIdProperty)
    {
        _ = builder.HasOne<ReleaseImportDraftTrack>()
            .WithMany()
            .HasForeignKey(CollectionIdProperty, DraftIdProperty, trackIdProperty)
            .HasPrincipalKey(nameof(ReleaseImportDraftTrack.CollectionId), nameof(ReleaseImportDraftTrack.DraftId), nameof(ReleaseImportDraftTrack.Id))
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureTargetDraftTrackReference(EntityTypeBuilder<ReleaseImportRelationSuggestion> builder, string trackIdProperty)
    {
        _ = builder.HasOne<ReleaseImportDraftTrack>()
            .WithMany()
            .HasForeignKey(CollectionIdProperty, trackIdProperty)
            .HasPrincipalKey(nameof(ReleaseImportDraftTrack.CollectionId), nameof(ReleaseImportDraftTrack.Id))
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureExistingTrackReference(EntityTypeBuilder<ReleaseImportRelationSuggestion> builder, string trackIdProperty)
    {
        _ = builder.HasOne<Domain.Catalog.Track>()
            .WithMany()
            .HasForeignKey(CollectionIdProperty, trackIdProperty)
            .HasPrincipalKey(nameof(Domain.Catalog.Track.CollectionId), nameof(Domain.Catalog.Track.Id))
            .OnDelete(DeleteBehavior.Restrict);
    }
}
