using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    public static async Task EnsureReleaseImportLooseFileCandidatesTableAsync(
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
            await EnsureColumnAsync(
                connection,
                "release_import_sessions",
                "loose_file_candidate_count",
                "ALTER TABLE release_import_sessions ADD COLUMN loose_file_candidate_count INTEGER NOT NULL DEFAULT 0;",
                afterAlterSql: null,
                afterAlterUpgradeKey: null,
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_release_import_sessions_collection_session_id ON release_import_sessions (collection_id, release_import_session_id);",
                cancellationToken);

            await using DbCommand createTable = connection.CreateCommand();
            createTable.CommandText =
                """
                CREATE TABLE IF NOT EXISTS release_import_loose_file_candidates (
                    id INTEGER NOT NULL CONSTRAINT pk_release_import_loose_file_candidates PRIMARY KEY AUTOINCREMENT,
                    release_import_loose_file_candidate_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_import_session_id TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    relative_path TEXT NOT NULL,
                    audio_file_format TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    last_modified_at TEXT NOT NULL,
                    content_hash TEXT NULL,
                    duration TEXT NULL,
                    codec TEXT NULL,
                    quality TEXT NULL,
                    bitrate_kbps INTEGER NULL,
                    sample_rate_hz INTEGER NULL,
                    channels INTEGER NULL,
                    title_hint TEXT NULL,
                    artist_hints_json TEXT NOT NULL,
                    album_title_hint TEXT NULL,
                    album_artist_hints_json TEXT NOT NULL,
                    track_number INTEGER NULL,
                    reason TEXT NOT NULL,
                    decision TEXT NOT NULL,
                    source_release_import_draft_id TEXT NULL,
                    source_release_import_draft_track_id TEXT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    CONSTRAINT release_import_loose_file_candidate_id UNIQUE (release_import_loose_file_candidate_id),
                    CONSTRAINT ak_release_import_loose_file_candidates_collection_candidate_id UNIQUE (collection_id, release_import_loose_file_candidate_id),
                    CONSTRAINT ux_release_import_loose_file_candidates_collection_session_relative_path UNIQUE (collection_id, release_import_session_id, relative_path),
                    CONSTRAINT fk_release_import_loose_file_candidates_sessions_collection_id_release_import_session_id
                        FOREIGN KEY (collection_id, release_import_session_id)
                        REFERENCES release_import_sessions (collection_id, release_import_session_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_loose_file_candidates_collections_collection_id
                        FOREIGN KEY (collection_id)
                        REFERENCES collections (collection_id)
                        ON DELETE CASCADE
                );
                """;
            _ = await createTable.ExecuteNonQueryAsync(cancellationToken);

            await EnsureLooseFileCandidateIndexesAsync(connection, cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task EnsureLooseFileCandidateIndexesAsync(
        DbConnection connection,
        CancellationToken cancellationToken)
    {
        await EnsureIndexAsync(connection, "CREATE INDEX IF NOT EXISTS IX_release_import_loose_file_candidates_collection_id_release_import_session_id ON release_import_loose_file_candidates (collection_id, release_import_session_id);", cancellationToken);
        await EnsureIndexAsync(connection, "CREATE UNIQUE INDEX IF NOT EXISTS IX_release_import_loose_file_candidates_collection_id_release_import_session_id_relative_path ON release_import_loose_file_candidates (collection_id, release_import_session_id, relative_path);", cancellationToken);
        await EnsureIndexAsync(connection, "CREATE INDEX IF NOT EXISTS IX_release_import_loose_file_candidates_collection_id_decision ON release_import_loose_file_candidates (collection_id, decision);", cancellationToken);
        await EnsureIndexAsync(connection, "CREATE INDEX IF NOT EXISTS IX_release_import_loose_file_candidates_collection_id_reason ON release_import_loose_file_candidates (collection_id, reason);", cancellationToken);
    }
}
