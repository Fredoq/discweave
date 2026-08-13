using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DiscWeave.Infrastructure.Persistence.Configurations;

internal sealed class ReleaseImportDraftConfiguration : IEntityTypeConfiguration<ReleaseImportDraft>
{
    public void Configure(EntityTypeBuilder<ReleaseImportDraft> builder)
    {
        _ = builder.ToTable("release_import_drafts");

        _ = builder.Property<long>("id").HasColumnName("id").ValueGeneratedOnAdd();
        _ = builder.HasKey("id");

        _ = builder.Property(draft => draft.Id).HasColumnName("release_import_draft_id").HasConversion(PersistenceValueConverters.ReleaseImportDraftId).ValueGeneratedNever();
        _ = builder.Property(draft => draft.CollectionId).HasColumnName("collection_id").HasConversion(PersistenceValueConverters.CollectionId).ValueGeneratedNever();
        _ = builder.Property(draft => draft.SessionId).HasColumnName("release_import_session_id").HasConversion(PersistenceValueConverters.ReleaseImportSessionId).ValueGeneratedNever();
        _ = builder.Property(draft => draft.SourceKind)
            .HasColumnName("source_kind")
            .HasConversion<string>()
            .HasMaxLength(64)
            .HasDefaultValue(ReleaseImportSourceKind.LocalFiles)
            .ValueGeneratedNever()
            .IsRequired();
        _ = builder.Property<string?>("_sourcePath").HasColumnName("source_path").HasMaxLength(4096);
        _ = builder.Property<string?>("_relativePath").HasColumnName("relative_path").HasMaxLength(4096);
        _ = builder.Property(draft => draft.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(64).IsRequired();
        _ = builder.Property(draft => draft.Title).HasColumnName("title").HasMaxLength(1024).IsRequired();
        _ = builder.Property(draft => draft.Type).HasColumnName("release_type").HasMaxLength(64).IsRequired();
        _ = builder.Property(draft => draft.CatalogNumber).HasColumnName("catalog_number").HasMaxLength(256);
        _ = builder.Property(draft => draft.LabelName).HasColumnName("label_name").HasMaxLength(512);
        _ = builder.Property(draft => draft.ReleaseDate).HasColumnName("release_date");
        _ = builder.Property(draft => draft.Year).HasColumnName("release_year");
        _ = builder.Property(draft => draft.IsVariousArtists).HasColumnName("is_various_artists");
        _ = builder.Property(draft => draft.NotOnLabel).HasColumnName("is_not_on_label");
        _ = builder.Property(draft => draft.CreateCatalogTracks).HasColumnName("create_catalog_tracks");
        _ = builder.Property(draft => draft.ExternalReviewRevision)
            .HasColumnName("external_review_revision")
            .IsConcurrencyToken();
        _ = builder.Property(draft => draft.IsSelectedOriginalBindingValid)
            .HasColumnName("is_selected_original_binding_valid");
        _ = builder.Property(draft => draft.CoverPath).HasColumnName("cover_path").HasMaxLength(4096);
        _ = builder.Property(draft => draft.CoverFileName).HasColumnName("cover_file_name").HasMaxLength(512);
        _ = builder.Property(draft => draft.CoverExtension).HasColumnName("cover_extension").HasMaxLength(32);
        _ = builder.Property(draft => draft.CoverContentType).HasColumnName("cover_content_type").HasMaxLength(128);
        _ = builder.Property(draft => draft.CoverSizeBytes).HasColumnName("cover_size_bytes");
        _ = builder.Property(draft => draft.CoverContent).HasColumnName("cover_content");
        _ = builder.Property(draft => draft.ConfirmedReleaseId).HasColumnName("confirmed_release_id").HasConversion(PersistenceValueConverters.NullableReleaseId);
        _ = builder.Property<string>("_artistNamesJson").HasColumnName("artist_names_json").HasMaxLength(8192);
        _ = builder.Property<string>("_artistCreditsJson").HasColumnName("artist_credits_json").HasMaxLength(16384);
        _ = builder.Property<string>("_labelsJson").HasColumnName("labels_json").HasMaxLength(8192);
        _ = builder.Property<string>("_selectedArtistIdsJson").HasColumnName("selected_artist_ids_json").HasMaxLength(8192);
        _ = builder.Property<string>("_genresJson").HasColumnName("genres_json").HasMaxLength(8192);
        _ = builder.Property<string>("_tagsJson").HasColumnName("tags_json").HasMaxLength(8192);
        _ = builder.Property<string>("_externalSourcesJson").HasColumnName("external_sources_json").HasMaxLength(8192);
        _ = builder.Property<string>("_issuesJson").HasColumnName("issues_json").HasMaxLength(8192);
        ConfigureExternalReview(builder);

        _ = builder.Ignore(draft => draft.ArtistNames);
        _ = builder.Ignore(draft => draft.ArtistCredits);
        _ = builder.Ignore(draft => draft.Labels);
        _ = builder.Ignore(draft => draft.SelectedArtistIds);
        _ = builder.Ignore(draft => draft.Genres);
        _ = builder.Ignore(draft => draft.Tags);
        _ = builder.Ignore(draft => draft.ExternalSources);
        _ = builder.Ignore(draft => draft.Issues);
        _ = builder.Ignore(draft => draft.SourcePath);
        _ = builder.Ignore(draft => draft.RelativePath);
        _ = builder.Ignore(draft => draft.SelectedOriginalBinding);
        _ = builder.Ignore(draft => draft.CollectionItemIntent);
        _ = builder.Ignore(draft => draft.LocalProvenanceSelection);

        _ = builder.HasAlternateKey(draft => draft.Id).HasName("release_import_draft_id");
        _ = builder.HasAlternateKey(draft => new { draft.CollectionId, draft.Id })
            .HasName("ak_release_import_drafts_collection_draft_id");
        _ = builder.HasAlternateKey(draft => new { draft.CollectionId, draft.Id, draft.SourceKind })
            .HasName("ak_release_import_drafts_collection_draft_source_kind");
        _ = builder.HasAlternateKey(draft => new { draft.CollectionId, draft.SessionId, draft.Id })
            .HasName("ak_release_import_drafts_collection_session_draft_id");
        _ = builder.HasIndex(draft => draft.CollectionId);
        _ = builder.HasIndex(draft => draft.SessionId);

        _ = builder.HasOne<ReleaseImportSession>()
            .WithMany()
            .HasForeignKey(draft => new { draft.CollectionId, draft.SessionId, draft.SourceKind })
            .HasPrincipalKey(session => new { session.CollectionId, session.Id, session.SourceKind })
            .OnDelete(DeleteBehavior.Cascade);
    }

    private static void ConfigureExternalReview(EntityTypeBuilder<ReleaseImportDraft> builder)
    {
        _ = builder.Property<TrackId?>("_bindingSourceTrackId")
            .HasColumnName("binding_source_track_id")
            .HasConversion(PersistenceValueConverters.NullableTrackId);
        _ = builder.Property<ReleaseImportDraftTrackId?>("_bindingDraftTrackId")
            .HasColumnName("binding_draft_track_id")
            .HasConversion(PersistenceValueConverters.NullableReleaseImportDraftTrackId);
        _ = builder.Property<string>("_bindingRecordingExternalId").HasColumnName("binding_recording_external_id").HasMaxLength(256);
        _ = builder.Property<string>("_bindingRecordingSourceUrl").HasColumnName("binding_recording_source_url").HasMaxLength(2048);
        _ = builder.Property<string>("_bindingMusicBrainzReleaseExternalId").HasColumnName("binding_musicbrainz_release_external_id").HasMaxLength(256);
        _ = builder.Property<string>("_bindingMusicBrainzReleaseSourceUrl").HasColumnName("binding_musicbrainz_release_source_url").HasMaxLength(2048);
        _ = builder.Property<string>("_bindingDiscogsReleaseExternalId").HasColumnName("binding_discogs_release_external_id").HasMaxLength(256);
        _ = builder.Property<string>("_bindingDiscogsReleaseSourceUrl").HasColumnName("binding_discogs_release_source_url").HasMaxLength(2048);
        _ = builder.Property<string>("_bindingMusicBrainzReleaseMbid").HasColumnName("binding_musicbrainz_release_mbid").HasMaxLength(36);
        _ = builder.Property<string>("_bindingMusicBrainzMediumPosition").HasColumnName("binding_musicbrainz_medium_position").HasMaxLength(32);
        _ = builder.Property<string>("_bindingMusicBrainzTrackMbid").HasColumnName("binding_musicbrainz_track_mbid").HasMaxLength(36);
        _ = builder.Property<string>("_bindingDiscogsRowReleaseId").HasColumnName("binding_discogs_row_release_id").HasMaxLength(32);
        _ = builder.Property<int?>("_bindingDiscogsRowOrdinal").HasColumnName("binding_discogs_row_ordinal");
        _ = builder.Property<string>("_bindingDiscogsRowPosition").HasColumnName("binding_discogs_row_position").HasMaxLength(64);
        _ = builder.Property<string>("_bindingDiscogsRowFingerprint").HasColumnName("binding_discogs_row_fingerprint").HasMaxLength(64);
        _ = builder.Property<bool>("_bindingPromoteLinkedTargetConfirmed").HasColumnName("binding_promote_linked_target_confirmed");
        _ = builder.Property<string>("_collectionItemIntentKind").HasColumnName("collection_item_intent_kind").HasMaxLength(32);
        _ = builder.Property<OwnedItemId?>("_reuseOwnedItemId")
            .HasColumnName("reuse_owned_item_id")
            .HasConversion(PersistenceValueConverters.NullableOwnedItemId);
        _ = builder.Property<string>("_intentMediumKind").HasColumnName("intent_medium_kind").HasMaxLength(32);
        _ = builder.Property<string>("_intentMediumText").HasColumnName("intent_medium_text").HasMaxLength(256);
        _ = builder.Property<int?>("_intentMediumDiscCount").HasColumnName("intent_medium_disc_count");
        _ = builder.Property<ReleaseId?>("_selectedReleaseId")
            .HasColumnName("selected_release_id")
            .HasConversion(PersistenceValueConverters.NullableReleaseId);
        _ = builder.Property<TrackId?>("_selectedTrackId")
            .HasColumnName("selected_track_id")
            .HasConversion(PersistenceValueConverters.NullableTrackId);

        _ = builder.HasOne<Track>()
            .WithMany()
            .HasForeignKey(nameof(ReleaseImportDraft.CollectionId), "_bindingSourceTrackId")
            .HasPrincipalKey(nameof(Track.CollectionId), nameof(Track.Id))
            .OnDelete(DeleteBehavior.Restrict);
        _ = builder.HasOne<ReleaseImportDraftTrack>()
            .WithMany()
            .HasForeignKey(nameof(ReleaseImportDraft.CollectionId), "_bindingDraftTrackId")
            .HasPrincipalKey(nameof(ReleaseImportDraftTrack.CollectionId), nameof(ReleaseImportDraftTrack.Id))
            .OnDelete(DeleteBehavior.Restrict);
        _ = builder.HasOne<OwnedItem>()
            .WithMany()
            .HasForeignKey(nameof(ReleaseImportDraft.CollectionId), "_reuseOwnedItemId")
            .HasPrincipalKey(nameof(OwnedItem.CollectionId), nameof(OwnedItem.Id))
            .OnDelete(DeleteBehavior.Restrict);
        _ = builder.HasOne<Release>()
            .WithMany()
            .HasForeignKey(nameof(ReleaseImportDraft.CollectionId), "_selectedReleaseId")
            .HasPrincipalKey(nameof(Release.CollectionId), nameof(Release.Id))
            .OnDelete(DeleteBehavior.Restrict);
        _ = builder.HasOne<Track>()
            .WithMany()
            .HasForeignKey(nameof(ReleaseImportDraft.CollectionId), "_selectedTrackId")
            .HasPrincipalKey(nameof(Track.CollectionId), nameof(Track.Id))
            .OnDelete(DeleteBehavior.Restrict);
    }
}
