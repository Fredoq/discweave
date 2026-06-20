using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class SqliteSchemaUpgraderTests
{
    [Fact(DisplayName = "SQLite schema upgrade creates import relation suggestions table with structured references")]
    public async Task Sqlite_schema_upgrade_creates_import_relation_suggestions_table_with_structured_references()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using (SqliteCommand create = connection.CreateCommand())
        {
            create.CommandText =
                """
                CREATE TABLE collections (
                    id INTEGER PRIMARY KEY,
                    collection_id TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL
                );

                CREATE TABLE release_import_sessions (
                    id INTEGER PRIMARY KEY,
                    release_import_session_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL
                );

                CREATE TABLE release_import_drafts (
                    id INTEGER PRIMARY KEY,
                    release_import_draft_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_import_session_id TEXT NOT NULL
                );

                CREATE TABLE release_import_draft_tracks (
                    id INTEGER PRIMARY KEY,
                    release_import_draft_track_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_import_draft_id TEXT NOT NULL
                );

                CREATE TABLE tracks (
                    id INTEGER PRIMARY KEY,
                    track_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL
                );
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureReleaseImportRelationSuggestionsTableAsync(connection);
        string[] columns = [.. await ReadColumnNamesAsync(connection, "release_import_relation_suggestions")];

        Assert.Contains("suggested_source_kind", columns);
        Assert.Contains("suggested_source_track_id", columns);
        Assert.Contains("suggested_target_kind", columns);
        Assert.Contains("suggested_target_track_id", columns);
        Assert.Contains("suggested_relation_type_code", columns);
        Assert.Contains("reviewed_source_kind", columns);
        Assert.Contains("reviewed_source_track_id", columns);
        Assert.Contains("reviewed_target_kind", columns);
        Assert.Contains("reviewed_target_track_id", columns);
        Assert.Contains("reviewed_relation_type_code", columns);
        Assert.True(await IndexExistsAsync(connection, "IX_release_import_relation_suggestions_collection_id_release_import_session_id_release_import_draft_id"));
        Assert.True(await IndexExistsAsync(connection, "IX_release_import_relation_suggestions_collection_id_suggested_source_track_id"));
        Assert.True(await IndexExistsAsync(connection, "IX_release_import_relation_suggestions_collection_id_suggested_target_track_id"));
        Assert.True(await IndexExistsAsync(connection, "ux_release_import_drafts_collection_session_draft_id"));
        Assert.True(await IndexExistsAsync(connection, "ux_release_import_draft_tracks_collection_draft_track_id"));
        Assert.True(await IndexExistsAsync(connection, "ux_release_import_draft_tracks_collection_track_id"));
        Assert.True(await IndexExistsAsync(connection, "ux_tracks_collection_track_id"));
        Assert.Contains("ck_release_import_relation_suggestions_suggested_source_kind", await ReadCreateTableSqlAsync(connection, "release_import_relation_suggestions"), StringComparison.Ordinal);

        await AssertImportRelationSuggestionInsertAsync(connection);
    }

    private static async Task AssertImportRelationSuggestionInsertAsync(SqliteConnection connection)
    {
        await using (SqliteCommand pragma = connection.CreateCommand())
        {
            pragma.CommandText = "PRAGMA foreign_keys = ON;";
            _ = await pragma.ExecuteNonQueryAsync();
        }

        string collectionId = Guid.NewGuid().ToString();
        string sessionId = Guid.NewGuid().ToString();
        string draftId = Guid.NewGuid().ToString();
        string targetDraftId = Guid.NewGuid().ToString();
        string draftTrackId = Guid.NewGuid().ToString();
        string targetDraftTrackId = Guid.NewGuid().ToString();
        string suggestionId = Guid.NewGuid().ToString();

        await using SqliteCommand insert = connection.CreateCommand();
        insert.CommandText =
            """
            INSERT INTO collections (collection_id, name)
            VALUES ($collectionId, 'Default');

            INSERT INTO release_import_sessions (release_import_session_id, collection_id)
            VALUES ($sessionId, $collectionId);

            INSERT INTO release_import_drafts (release_import_draft_id, collection_id, release_import_session_id)
            VALUES ($draftId, $collectionId, $sessionId);

            INSERT INTO release_import_drafts (release_import_draft_id, collection_id, release_import_session_id)
            VALUES ($targetDraftId, $collectionId, $sessionId);

            INSERT INTO release_import_draft_tracks (release_import_draft_track_id, collection_id, release_import_draft_id)
            VALUES ($draftTrackId, $collectionId, $draftId);

            INSERT INTO release_import_draft_tracks (release_import_draft_track_id, collection_id, release_import_draft_id)
            VALUES ($targetDraftTrackId, $collectionId, $targetDraftId);

            INSERT INTO release_import_relation_suggestions (
                release_import_relation_suggestion_id,
                collection_id,
                release_import_session_id,
                release_import_draft_id,
                token,
                confidence,
                decision,
                suggested_source_kind,
                suggested_source_track_id,
                suggested_target_kind,
                suggested_target_track_id,
                suggested_target_draft_track_id,
                suggested_target_existing_track_id,
                suggested_relation_type_code,
                reviewed_source_kind,
                reviewed_source_track_id,
                reviewed_target_kind,
                reviewed_target_track_id,
                reviewed_target_draft_track_id,
                reviewed_target_existing_track_id,
                reviewed_relation_type_code,
                suggested_payload_json,
                reviewed_payload_json)
            VALUES (
                $suggestionId,
                $collectionId,
                $sessionId,
                $draftId,
                'Radio Edit',
                95,
                'Pending',
                'DraftTrack',
                $draftTrackId,
                'DraftTrack',
                $targetDraftTrackId,
                $targetDraftTrackId,
                NULL,
                'editOf',
                'DraftTrack',
                $draftTrackId,
                'DraftTrack',
                $targetDraftTrackId,
                $targetDraftTrackId,
                NULL,
                'editOf',
                '{}',
                '{}');
            """;
        _ = insert.Parameters.AddWithValue("$collectionId", collectionId);
        _ = insert.Parameters.AddWithValue("$sessionId", sessionId);
        _ = insert.Parameters.AddWithValue("$draftId", draftId);
        _ = insert.Parameters.AddWithValue("$targetDraftId", targetDraftId);
        _ = insert.Parameters.AddWithValue("$draftTrackId", draftTrackId);
        _ = insert.Parameters.AddWithValue("$targetDraftTrackId", targetDraftTrackId);
        _ = insert.Parameters.AddWithValue("$suggestionId", suggestionId);

        Assert.True((await insert.ExecuteNonQueryAsync()) > 0);
    }
}
