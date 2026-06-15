using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Tests;

public sealed class SqliteSchemaUpgraderTests : IClassFixture<SqliteFixture>
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
                    collection_id TEXT NOT NULL,
                    CONSTRAINT ak_release_import_sessions_collection_session_id UNIQUE (collection_id, release_import_session_id)
                );

                CREATE TABLE release_import_drafts (
                    id INTEGER PRIMARY KEY,
                    release_import_draft_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_import_session_id TEXT NOT NULL,
                    CONSTRAINT ak_release_import_drafts_collection_draft_id UNIQUE (collection_id, release_import_draft_id),
                    CONSTRAINT ak_release_import_drafts_collection_session_draft_id UNIQUE (collection_id, release_import_session_id, release_import_draft_id)
                );

                CREATE TABLE release_import_draft_tracks (
                    id INTEGER PRIMARY KEY,
                    release_import_draft_track_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_import_draft_id TEXT NOT NULL,
                    CONSTRAINT ak_release_import_draft_tracks_collection_draft_track_id UNIQUE (collection_id, release_import_draft_id, release_import_draft_track_id)
                );

                CREATE TABLE tracks (
                    id INTEGER PRIMARY KEY,
                    track_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    CONSTRAINT ak_tracks_collection_track_id UNIQUE (collection_id, track_id)
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
        Assert.Contains("ck_release_import_relation_suggestions_suggested_source_kind", await ReadCreateTableSqlAsync(connection, "release_import_relation_suggestions"), StringComparison.Ordinal);
    }

    private static async Task<IReadOnlyList<string>> ReadColumnNamesAsync(
        SqliteConnection connection,
        string tableName)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName});";
        await using SqliteDataReader reader = await command.ExecuteReaderAsync();
        List<string> columns = [];
        while (await reader.ReadAsync())
        {
            columns.Add(reader.GetString(1));
        }

        return columns;
    }

    private static async Task<bool> IndexExistsAsync(SqliteConnection connection, string indexName)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = $indexName;";
        _ = command.Parameters.AddWithValue("$indexName", indexName);

        return await command.ExecuteScalarAsync() is not null;
    }

    private static async Task<string> ReadCreateTableSqlAsync(SqliteConnection connection, string tableName)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = $tableName;";
        _ = command.Parameters.AddWithValue("$tableName", tableName);

        return Assert.IsType<string>(await command.ExecuteScalarAsync());
    }
}
