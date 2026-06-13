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
}
