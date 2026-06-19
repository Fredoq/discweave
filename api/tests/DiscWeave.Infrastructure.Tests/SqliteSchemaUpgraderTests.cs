using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class SqliteSchemaUpgraderTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public SqliteSchemaUpgraderTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "SQLite schema upgrade adds import draft external sources column")]
    public async Task Sqlite_schema_upgrade_adds_import_draft_external_sources_column()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using (SqliteCommand create = connection.CreateCommand())
        {
            create.CommandText =
                """
                CREATE TABLE release_import_drafts (
                    id INTEGER PRIMARY KEY,
                    release_import_draft_id TEXT NOT NULL
                );
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureReleaseImportDraftExternalSourcesColumnAsync(connection);

        string[] columns = [.. await ReadColumnNamesAsync(connection, "release_import_drafts")];
        Assert.Contains("external_sources_json", columns);
    }

    [Fact(DisplayName = "SQLite schema upgrade backfills existing import draft track inheritance column once")]
    public async Task Sqlite_schema_upgrade_backfills_existing_import_draft_track_inheritance_column_once()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using (SqliteCommand create = connection.CreateCommand())
        {
            create.CommandText =
                """
                CREATE TABLE release_import_draft_tracks (
                    id INTEGER PRIMARY KEY,
                    artist_credits_json TEXT NOT NULL,
                    artist_names_json TEXT NOT NULL,
                    inherit_release_artist_credits INTEGER NOT NULL DEFAULT 0
                );

                INSERT INTO release_import_draft_tracks (artist_credits_json, artist_names_json, inherit_release_artist_credits)
                VALUES ('[]', '[]', 0);
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureReleaseImportDraftTrackInheritanceColumnAsync(connection);
        await using (SqliteCommand firstQuery = connection.CreateCommand())
        {
            firstQuery.CommandText = "SELECT inherit_release_artist_credits FROM release_import_draft_tracks LIMIT 1;";
            object? firstValue = await firstQuery.ExecuteScalarAsync();
            Assert.Equal(1L, firstValue);
        }

        await using (SqliteCommand reset = connection.CreateCommand())
        {
            reset.CommandText = "UPDATE release_import_draft_tracks SET inherit_release_artist_credits = 0;";
            _ = await reset.ExecuteNonQueryAsync();
        }

        await using SqliteCommand query = connection.CreateCommand();
        await SqliteSchemaUpgrader.EnsureReleaseImportDraftTrackInheritanceColumnAsync(connection);
        query.CommandText = "SELECT inherit_release_artist_credits FROM release_import_draft_tracks LIMIT 1;";
        object? value = await query.ExecuteScalarAsync();

        Assert.Equal(0L, value);
    }

    [Fact(DisplayName = "SQLite schema upgrade adds stable release track identifiers")]
    public async Task Sqlite_schema_upgrade_adds_stable_release_track_identifiers()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using (SqliteCommand create = connection.CreateCommand())
        {
            create.CommandText =
                """
                CREATE TABLE release_tracks (
                    id INTEGER PRIMARY KEY,
                    release_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    track_id TEXT NOT NULL
                );

                INSERT INTO release_tracks (release_id, collection_id, track_id)
                VALUES
                    ('release-1', 'collection-1', 'track-1'),
                    ('release-1', 'collection-1', 'track-2');
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureReleaseTrackIdsAsync(connection);

        string[] columns = [.. await ReadColumnNamesAsync(connection, "release_tracks")];
        string[] firstIds = [.. await ReadReleaseTrackIdsAsync(connection)];

        await SqliteSchemaUpgrader.EnsureReleaseTrackIdsAsync(connection);

        string[] secondIds = [.. await ReadReleaseTrackIdsAsync(connection)];

        Assert.Contains("release_track_id", columns);
        Assert.True(await IndexExistsAsync(connection, "ix_release_tracks_collection_release_track_id"));
        Assert.Equal(2, firstIds.Length);
        Assert.Equal(2, firstIds.Distinct(StringComparer.Ordinal).Count());
        Assert.All(firstIds, id => _ = Guid.Parse(id));
        Assert.Equal(firstIds, secondIds);
    }

    [Fact(DisplayName = "SQLite schema upgrade creates track relation parser rules table")]
    public async Task Sqlite_schema_upgrade_creates_track_relation_parser_rules_table()
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
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureTrackRelationParserRulesTableAsync(connection);

        string[] columns = [.. await ReadColumnNamesAsync(connection, "track_relation_parser_rules")];
        Assert.Contains("track_relation_parser_rule_id", columns);
        Assert.Contains("collection_id", columns);
        Assert.Contains("relation_type_code", columns);
        Assert.Contains("alias", columns);
        Assert.Contains("match_mode", columns);
        Assert.Contains("confidence", columns);
        Assert.Contains("direction", columns);
        Assert.Contains("sort_order", columns);
        Assert.Contains("is_active", columns);
        Assert.Contains("is_builtin", columns);
        Assert.True(await IndexExistsAsync(connection, "ux_track_relation_parser_rules_collection_type_alias_mode"));
    }

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
