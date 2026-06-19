using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    public static async Task EnsureLocalAudioFileTablesAsync(
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
            await using DbCommand createLocalAudioFiles = connection.CreateCommand();
            createLocalAudioFiles.CommandText =
                """
                CREATE TABLE IF NOT EXISTS local_audio_files (
                    id INTEGER NOT NULL CONSTRAINT pk_local_audio_files PRIMARY KEY AUTOINCREMENT,
                    local_audio_file_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    path TEXT NOT NULL,
                    format TEXT NULL,
                    codec TEXT NULL,
                    quality TEXT NULL,
                    size_bytes INTEGER NULL,
                    modified_at TEXT NULL,
                    content_hash TEXT NULL,
                    duration_ticks INTEGER NULL,
                    bitrate_kbps INTEGER NULL,
                    sample_rate_hz INTEGER NULL,
                    channels INTEGER NULL,
                    import_identity_path TEXT NULL,
                    import_identity_size_bytes INTEGER NULL,
                    import_identity_last_modified_at TEXT NULL,
                    import_identity_content_hash TEXT NULL,
                    CONSTRAINT ak_local_audio_files_collection_local_audio_file_id UNIQUE (collection_id, local_audio_file_id),
                    CONSTRAINT fk_local_audio_files_collections_collection_id FOREIGN KEY (collection_id) REFERENCES collections (collection_id) ON DELETE CASCADE
                );
                """;
            _ = await createLocalAudioFiles.ExecuteNonQueryAsync(cancellationToken);

            await using DbCommand createDigitalTrackFileLinks = connection.CreateCommand();
            createDigitalTrackFileLinks.CommandText =
                """
                CREATE TABLE IF NOT EXISTS digital_track_file_links (
                    id INTEGER NOT NULL CONSTRAINT pk_digital_track_file_links PRIMARY KEY AUTOINCREMENT,
                    digital_track_file_link_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    digital_owned_item_id TEXT NOT NULL,
                    release_track_id TEXT NOT NULL,
                    local_audio_file_id TEXT NOT NULL,
                    CONSTRAINT ak_digital_track_file_links_collection_link_id UNIQUE (collection_id, digital_track_file_link_id),
                    CONSTRAINT fk_digital_track_file_links_owned_items FOREIGN KEY (collection_id, digital_owned_item_id) REFERENCES owned_items (collection_id, owned_item_id) ON DELETE CASCADE,
                    CONSTRAINT fk_digital_track_file_links_release_tracks FOREIGN KEY (collection_id, release_track_id) REFERENCES release_tracks (collection_id, release_track_id) ON DELETE CASCADE,
                    CONSTRAINT fk_digital_track_file_links_local_audio_files FOREIGN KEY (collection_id, local_audio_file_id) REFERENCES local_audio_files (collection_id, local_audio_file_id) ON DELETE RESTRICT
                );
                """;
            _ = await createDigitalTrackFileLinks.ExecuteNonQueryAsync(cancellationToken);

            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_local_audio_files_collection_path ON local_audio_files (collection_id, path);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS ix_local_audio_files_collection_content_hash ON local_audio_files (collection_id, content_hash);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS ix_local_audio_files_import_identity ON local_audio_files (collection_id, import_identity_path, import_identity_size_bytes, import_identity_last_modified_at, import_identity_content_hash);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_digital_track_file_links_collection_owned_item_release_track ON digital_track_file_links (collection_id, digital_owned_item_id, release_track_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS ix_digital_track_file_links_collection_local_audio_file ON digital_track_file_links (collection_id, local_audio_file_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS ix_digital_track_file_links_collection_release_track ON digital_track_file_links (collection_id, release_track_id);",
                cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }
}
