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

    [Fact(DisplayName = "SQLite schema upgrade adds import draft track technical columns")]
    public async Task Sqlite_schema_upgrade_adds_import_draft_track_technical_columns()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using (SqliteCommand create = connection.CreateCommand())
        {
            create.CommandText =
                """
                CREATE TABLE release_import_draft_tracks (
                    id INTEGER PRIMARY KEY
                );
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureReleaseImportDraftTrackTechnicalColumnsAsync(connection);
        await SqliteSchemaUpgrader.EnsureReleaseImportDraftTrackTechnicalColumnsAsync(connection);

        string[] columns = [.. await ReadColumnNamesAsync(connection, "release_import_draft_tracks")];
        Assert.Contains("codec", columns);
        Assert.Contains("quality", columns);
        Assert.Contains("bitrate_kbps", columns);
        Assert.Contains("sample_rate_hz", columns);
        Assert.Contains("channels", columns);
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

    [Fact(DisplayName = "SQLite schema upgrade creates local audio file link tables")]
    public async Task Sqlite_schema_upgrade_creates_local_audio_file_link_tables()
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

                CREATE TABLE owned_items (
                    id INTEGER PRIMARY KEY,
                    owned_item_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_id TEXT NOT NULL,
                    ownership_status TEXT NOT NULL,
                    medium_type TEXT NOT NULL,
                    CONSTRAINT ak_owned_items_collection_owned_item_id UNIQUE (collection_id, owned_item_id)
                );

                CREATE TABLE release_tracks (
                    id INTEGER PRIMARY KEY,
                    release_track_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_id TEXT NOT NULL,
                    track_id TEXT NOT NULL
                );

                CREATE UNIQUE INDEX ix_release_tracks_collection_release_track_id
                    ON release_tracks (collection_id, release_track_id);
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureLocalAudioFileTablesAsync(connection);
        await SqliteSchemaUpgrader.EnsureLocalAudioFileTablesAsync(connection);

        string[] localAudioFileColumns = [.. await ReadColumnNamesAsync(connection, "local_audio_files")];
        string[] digitalTrackFileLinkColumns = [.. await ReadColumnNamesAsync(connection, "digital_track_file_links")];

        Assert.Contains("local_audio_file_id", localAudioFileColumns);
        Assert.Contains("path", localAudioFileColumns);
        Assert.Contains("content_hash", localAudioFileColumns);
        Assert.Contains("digital_track_file_link_id", digitalTrackFileLinkColumns);
        Assert.Contains("digital_owned_item_id", digitalTrackFileLinkColumns);
        Assert.Contains("release_track_id", digitalTrackFileLinkColumns);
        Assert.True(await IndexExistsAsync(connection, "ux_local_audio_files_collection_path"));
        Assert.True(await IndexExistsAsync(connection, "ix_local_audio_files_collection_content_hash"));
        Assert.True(await IndexExistsAsync(connection, "ux_digital_track_file_links_collection_owned_item_release_track"));
    }

}
