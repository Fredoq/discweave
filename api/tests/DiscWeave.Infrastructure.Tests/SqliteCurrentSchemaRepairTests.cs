using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Tests;

public sealed class SqliteCurrentSchemaRepairTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public SqliteCurrentSchemaRepairTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "SQLite repair adds and backfills identity keys for legacy relation and credit tables")]
    public async Task SQLite_repair_adds_and_backfills_identity_keys_for_legacy_relation_and_credit_tables()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        TestIds ids = await CreateLegacyIdentitySchemaAsync(connection);

        await SqliteCurrentSchemaRepair.ApplyAsync(connection, CancellationToken.None);

        Assert.True(await ColumnExistsAsync(connection, "artist_relations", "identity_key"));
        Assert.True(await ColumnExistsAsync(connection, "track_relations", "identity_key"));
        Assert.True(await ColumnExistsAsync(connection, "credits", "identity_key"));
        Assert.Equal(
            $"{ids.SourceArtistId:D}|{ids.TargetArtistId:D}|memberOf|1991|none",
            await ReadScalarAsync(connection, "SELECT identity_key FROM artist_relations"));
        Assert.Equal(
            $"{ids.SourceTrackId:D}|{ids.TargetTrackId:D}|remixOf",
            await ReadScalarAsync(connection, "SELECT identity_key FROM track_relations"));
        Assert.Equal(
            $"track|{ids.TargetTrackId:D}|{ids.ContributorArtistId:D}|Engineer,Producer",
            await ReadScalarAsync(connection, "SELECT identity_key FROM credits"));
    }

    private static async Task<TestIds> CreateLegacyIdentitySchemaAsync(SqliteConnection connection)
    {
        var ids = new TestIds(
            Guid.Parse("11111111-1111-1111-1111-111111111111"),
            Guid.Parse("22222222-2222-2222-2222-222222222222"),
            Guid.Parse("33333333-3333-3333-3333-333333333333"),
            Guid.Parse("44444444-4444-4444-4444-444444444444"),
            Guid.Parse("55555555-5555-5555-5555-555555555555"));
        await ExecuteAsync(
            connection,
            """
            CREATE TABLE artist_relations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection_id TEXT NOT NULL,
                artist_relation_id TEXT NOT NULL,
                source_artist_id TEXT NOT NULL,
                target_artist_id TEXT NOT NULL,
                type TEXT NOT NULL,
                period_end_year INTEGER NULL,
                period_start_year INTEGER NULL
            );
            CREATE TABLE track_relations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection_id TEXT NOT NULL,
                track_relation_id TEXT NOT NULL,
                source_track_id TEXT NOT NULL,
                target_track_id TEXT NOT NULL,
                relation_type TEXT NOT NULL
            );
            CREATE TABLE credits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection_id TEXT NOT NULL,
                credit_id TEXT NOT NULL,
                role TEXT NOT NULL,
                contributor_artist_id TEXT NOT NULL,
                contributor_name TEXT NOT NULL,
                roles_json TEXT NOT NULL,
                target_release_id TEXT NULL,
                target_track_id TEXT NULL,
                target_type TEXT NOT NULL
            );
            """);
        await ExecuteAsync(
            connection,
            $$"""
            INSERT INTO artist_relations (
                collection_id,
                artist_relation_id,
                source_artist_id,
                target_artist_id,
                type,
                period_start_year,
                period_end_year
            )
            VALUES (
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
                '{{ids.SourceArtistId:D}}',
                '{{ids.TargetArtistId:D}}',
                'memberOf',
                1991,
                NULL
            );
            INSERT INTO track_relations (
                collection_id,
                track_relation_id,
                source_track_id,
                target_track_id,
                relation_type
            )
            VALUES (
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'cccccccc-cccc-cccc-cccc-cccccccccccc',
                '{{ids.SourceTrackId:D}}',
                '{{ids.TargetTrackId:D}}',
                'remixOf'
            );
            INSERT INTO credits (
                collection_id,
                credit_id,
                role,
                contributor_artist_id,
                contributor_name,
                roles_json,
                target_release_id,
                target_track_id,
                target_type
            )
            VALUES (
                'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
                'dddddddd-dddd-dddd-dddd-dddddddddddd',
                'Producer',
                '{{ids.ContributorArtistId:D}}',
                'Example Person',
                '["Producer"," Engineer ",""]',
                NULL,
                '{{ids.TargetTrackId:D}}',
                'track'
            );
            """);

        return ids;
    }

    private static async Task<bool> ColumnExistsAsync(SqliteConnection connection, string tableName, string columnName)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName})";
        await using SqliteDataReader reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    private static async Task<string> ReadScalarAsync(SqliteConnection connection, string sql)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = sql;
        object? value = await command.ExecuteScalarAsync();
        return Assert.IsType<string>(value);
    }

    private static async Task ExecuteAsync(SqliteConnection connection, string sql)
    {
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = sql;
        _ = await command.ExecuteNonQueryAsync();
    }

    private sealed record TestIds(
        Guid SourceArtistId,
        Guid TargetArtistId,
        Guid SourceTrackId,
        Guid TargetTrackId,
        Guid ContributorArtistId);
}
