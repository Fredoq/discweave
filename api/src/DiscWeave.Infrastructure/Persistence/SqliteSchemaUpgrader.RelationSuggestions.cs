using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    public static async Task EnsureReleaseImportRelationSuggestionsTableAsync(
        DbConnection connection,
        CancellationToken cancellationToken = default)
    {
        bool shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_release_import_drafts_collection_session_draft_id ON release_import_drafts (collection_id, release_import_session_id, release_import_draft_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_release_import_draft_tracks_collection_draft_track_id ON release_import_draft_tracks (collection_id, release_import_draft_id, release_import_draft_track_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_release_import_draft_tracks_collection_track_id ON release_import_draft_tracks (collection_id, release_import_draft_track_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_tracks_collection_track_id ON tracks (collection_id, track_id);",
                cancellationToken);

            await using DbCommand createTable = connection.CreateCommand();
            createTable.CommandText =
                """
                CREATE TABLE IF NOT EXISTS release_import_relation_suggestions (
                    id INTEGER NOT NULL CONSTRAINT pk_release_import_relation_suggestions PRIMARY KEY AUTOINCREMENT,
                    release_import_relation_suggestion_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_import_session_id TEXT NOT NULL,
                    release_import_draft_id TEXT NOT NULL,
                    token TEXT NOT NULL,
                    confidence INTEGER NOT NULL,
                    decision TEXT NOT NULL,
                    suggested_source_kind TEXT NOT NULL,
                    suggested_source_track_id TEXT NOT NULL,
                    suggested_target_kind TEXT NULL,
                    suggested_target_track_id TEXT NULL,
                    suggested_target_draft_track_id TEXT NULL,
                    suggested_target_existing_track_id TEXT NULL,
                    suggested_relation_type_code TEXT NOT NULL,
                    reviewed_source_kind TEXT NOT NULL,
                    reviewed_source_track_id TEXT NOT NULL,
                    reviewed_target_kind TEXT NULL,
                    reviewed_target_track_id TEXT NULL,
                    reviewed_target_draft_track_id TEXT NULL,
                    reviewed_target_existing_track_id TEXT NULL,
                    reviewed_relation_type_code TEXT NOT NULL,
                    suggested_payload_json TEXT NOT NULL,
                    reviewed_payload_json TEXT NOT NULL,
                    CONSTRAINT release_import_relation_suggestion_id UNIQUE (release_import_relation_suggestion_id),
                    CONSTRAINT ak_release_import_relation_suggestions_collection_suggestion_id UNIQUE (collection_id, release_import_relation_suggestion_id),
                    CONSTRAINT ck_release_import_relation_suggestions_suggested_source_kind CHECK (suggested_source_kind = 'DraftTrack'),
                    CONSTRAINT ck_release_import_relation_suggestions_reviewed_source_kind CHECK (reviewed_source_kind = 'DraftTrack'),
                    CONSTRAINT ck_release_import_relation_suggestions_suggested_target_consistency CHECK (
                        (suggested_target_kind IS NULL AND suggested_target_track_id IS NULL AND suggested_target_draft_track_id IS NULL AND suggested_target_existing_track_id IS NULL) OR
                        (suggested_target_kind = 'DraftTrack' AND suggested_target_track_id IS NOT NULL AND suggested_target_draft_track_id = suggested_target_track_id AND suggested_target_existing_track_id IS NULL) OR
                        (suggested_target_kind = 'ExistingTrack' AND suggested_target_track_id IS NOT NULL AND suggested_target_existing_track_id = suggested_target_track_id AND suggested_target_draft_track_id IS NULL)
                    ),
                    CONSTRAINT ck_release_import_relation_suggestions_reviewed_target_consistency CHECK (
                        (reviewed_target_kind IS NULL AND reviewed_target_track_id IS NULL AND reviewed_target_draft_track_id IS NULL AND reviewed_target_existing_track_id IS NULL) OR
                        (reviewed_target_kind = 'DraftTrack' AND reviewed_target_track_id IS NOT NULL AND reviewed_target_draft_track_id = reviewed_target_track_id AND reviewed_target_existing_track_id IS NULL) OR
                        (reviewed_target_kind = 'ExistingTrack' AND reviewed_target_track_id IS NOT NULL AND reviewed_target_existing_track_id = reviewed_target_track_id AND reviewed_target_draft_track_id IS NULL)
                    ),
                    CONSTRAINT fk_release_import_relation_suggestions_release_import_drafts_collection_id_release_import_session_id_release_import_draft_id
                        FOREIGN KEY (collection_id, release_import_session_id, release_import_draft_id)
                        REFERENCES release_import_drafts (collection_id, release_import_session_id, release_import_draft_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_suggested_source_draft_tracks
                        FOREIGN KEY (collection_id, release_import_draft_id, suggested_source_track_id)
                        REFERENCES release_import_draft_tracks (collection_id, release_import_draft_id, release_import_draft_track_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_reviewed_source_draft_tracks
                        FOREIGN KEY (collection_id, release_import_draft_id, reviewed_source_track_id)
                        REFERENCES release_import_draft_tracks (collection_id, release_import_draft_id, release_import_draft_track_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_suggested_target_draft_tracks
                        FOREIGN KEY (collection_id, suggested_target_draft_track_id)
                        REFERENCES release_import_draft_tracks (collection_id, release_import_draft_track_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_reviewed_target_draft_tracks
                        FOREIGN KEY (collection_id, reviewed_target_draft_track_id)
                        REFERENCES release_import_draft_tracks (collection_id, release_import_draft_track_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_suggested_target_tracks
                        FOREIGN KEY (collection_id, suggested_target_existing_track_id)
                        REFERENCES tracks (collection_id, track_id)
                        ON DELETE RESTRICT,
                    CONSTRAINT fk_release_import_relation_suggestions_reviewed_target_tracks
                        FOREIGN KEY (collection_id, reviewed_target_existing_track_id)
                        REFERENCES tracks (collection_id, track_id)
                        ON DELETE RESTRICT
                );
                """;
            _ = await createTable.ExecuteNonQueryAsync(cancellationToken);

            await EnsureRelationSuggestionIndexesAsync(connection, cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task EnsureRelationSuggestionIndexesAsync(
        DbConnection connection,
        CancellationToken cancellationToken)
    {
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_release_import_session_id ON release_import_relation_suggestions (collection_id, release_import_session_id);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_release_import_draft_id ON release_import_relation_suggestions (collection_id, release_import_draft_id);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_release_import_session_id_release_import_draft_id ON release_import_relation_suggestions (collection_id, release_import_session_id, release_import_draft_id);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_suggested_source_track_id ON release_import_relation_suggestions (collection_id, suggested_source_track_id);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_suggested_target_track_id ON release_import_relation_suggestions (collection_id, suggested_target_track_id);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_reviewed_source_track_id ON release_import_relation_suggestions (collection_id, reviewed_source_track_id);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_reviewed_target_track_id ON release_import_relation_suggestions (collection_id, reviewed_target_track_id);",
            cancellationToken);
    }
}
