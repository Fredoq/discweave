using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class SqliteSchemaUpgraderTests
{
    [Fact(DisplayName = "SQLite schema upgrade migrates alias artist relations to aliasOf")]
    public async Task Sqlite_schema_upgrade_migrates_alias_artist_relations_to_alias_of()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using (SqliteCommand create = connection.CreateCommand())
        {
            create.CommandText =
                """
                CREATE TABLE artist_relations (
                    id INTEGER PRIMARY KEY,
                    collection_id TEXT NOT NULL,
                    source_artist_id TEXT NOT NULL,
                    target_artist_id TEXT NOT NULL,
                    type TEXT NOT NULL
                );

                CREATE TABLE collection_dictionary_entries (
                    id INTEGER PRIMARY KEY,
                    collection_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    code TEXT NOT NULL,
                    name TEXT NOT NULL
                );

                INSERT INTO artist_relations (collection_id, source_artist_id, target_artist_id, type)
                VALUES ('collection-1', 'source-1', 'target-1', 'alias');

                INSERT INTO collection_dictionary_entries (collection_id, kind, code, name)
                VALUES ('collection-1', 'ArtistRelationType', 'alias', 'Alias');
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureArtistRelationAliasOfSchemaAsync(connection);
        await SqliteSchemaUpgrader.EnsureArtistRelationAliasOfSchemaAsync(connection);

        await using (SqliteCommand relationQuery = connection.CreateCommand())
        {
            relationQuery.CommandText = "SELECT type FROM artist_relations LIMIT 1;";
            Assert.Equal("aliasOf", await relationQuery.ExecuteScalarAsync());
        }

        await using (SqliteCommand dictionaryQuery = connection.CreateCommand())
        {
            dictionaryQuery.CommandText = "SELECT code || ':' || name FROM collection_dictionary_entries LIMIT 1;";
            Assert.Equal("aliasOf:Alias of", await dictionaryQuery.ExecuteScalarAsync());
        }

        Assert.True(await IndexExistsAsync(connection, "ux_artist_relations_collection_source_alias_of"));
    }

    [Fact(DisplayName = "SQLite schema upgrade enforces one outgoing aliasOf relation")]
    public async Task Sqlite_schema_upgrade_enforces_one_outgoing_alias_of_relation()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using (SqliteCommand create = connection.CreateCommand())
        {
            create.CommandText =
                """
                CREATE TABLE artist_relations (
                    id INTEGER PRIMARY KEY,
                    collection_id TEXT NOT NULL,
                    source_artist_id TEXT NOT NULL,
                    target_artist_id TEXT NOT NULL,
                    type TEXT NOT NULL
                );

                CREATE TABLE collection_dictionary_entries (
                    id INTEGER PRIMARY KEY,
                    collection_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    code TEXT NOT NULL,
                    name TEXT NOT NULL
                );
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureArtistRelationAliasOfSchemaAsync(connection);

        await using (SqliteCommand insert = connection.CreateCommand())
        {
            insert.CommandText =
                """
                INSERT INTO artist_relations (collection_id, source_artist_id, target_artist_id, type)
                VALUES ('collection-1', 'source-1', 'target-1', 'aliasOf');
                """;
            _ = await insert.ExecuteNonQueryAsync();
        }

        await using SqliteCommand duplicateInsert = connection.CreateCommand();
        duplicateInsert.CommandText =
            """
            INSERT INTO artist_relations (collection_id, source_artist_id, target_artist_id, type)
            VALUES ('collection-1', 'source-1', 'target-2', 'aliasOf');
            """;
        SqliteException exception = await Assert.ThrowsAsync<SqliteException>(
            duplicateInsert.ExecuteNonQueryAsync);

        Assert.Equal(19, exception.SqliteErrorCode);
        Assert.Equal(2067, exception.SqliteExtendedErrorCode);
    }

    [Fact(DisplayName = "SQLite schema upgrade deduplicates legacy alias relations")]
    public async Task Sqlite_schema_upgrade_deduplicates_legacy_alias_relations()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using (SqliteCommand create = connection.CreateCommand())
        {
            create.CommandText =
                """
                CREATE TABLE artist_relations (
                    id INTEGER PRIMARY KEY,
                    collection_id TEXT NOT NULL,
                    source_artist_id TEXT NOT NULL,
                    target_artist_id TEXT NOT NULL,
                    type TEXT NOT NULL
                );

                CREATE TABLE collection_dictionary_entries (
                    id INTEGER PRIMARY KEY,
                    collection_id TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    code TEXT NOT NULL,
                    name TEXT NOT NULL
                );

                INSERT INTO artist_relations (id, collection_id, source_artist_id, target_artist_id, type)
                VALUES
                    (10, 'collection-1', 'source-1', 'target-1', 'alias'),
                    (11, 'collection-1', 'source-1', 'target-2', 'alias'),
                    (12, 'collection-1', 'source-1', 'target-3', 'aliasOf'),
                    (13, 'collection-1', 'source-2', 'target-4', 'alias');
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureArtistRelationAliasOfSchemaAsync(connection);

        await using (SqliteCommand countQuery = connection.CreateCommand())
        {
            countQuery.CommandText = "SELECT COUNT(*) FROM artist_relations WHERE source_artist_id = 'source-1';";
            Assert.Equal(1L, await countQuery.ExecuteScalarAsync());
        }

        await using (SqliteCommand keptRelationQuery = connection.CreateCommand())
        {
            keptRelationQuery.CommandText = "SELECT target_artist_id || ':' || type FROM artist_relations WHERE source_artist_id = 'source-1';";
            Assert.Equal("target-1:aliasOf", await keptRelationQuery.ExecuteScalarAsync());
        }

        await using (SqliteCommand otherRelationQuery = connection.CreateCommand())
        {
            otherRelationQuery.CommandText = "SELECT target_artist_id || ':' || type FROM artist_relations WHERE source_artist_id = 'source-2';";
            Assert.Equal("target-4:aliasOf", await otherRelationQuery.ExecuteScalarAsync());
        }

        Assert.True(await IndexExistsAsync(connection, "ux_artist_relations_collection_source_alias_of"));
    }
}
