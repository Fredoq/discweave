using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class SqliteSchemaUpgraderTests
{
    [Fact(DisplayName = "SQLite schema upgrade creates collection review issue states table")]
    public async Task Sqlite_schema_upgrade_creates_collection_review_issue_states_table()
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

        await SqliteSchemaUpgrader.EnsureCollectionReviewIssueStatesTableAsync(connection);

        string[] columns = [.. await ReadColumnNamesAsync(connection, "collection_review_issue_states")];
        Assert.Contains("collection_review_issue_state_id", columns);
        Assert.Contains("collection_id", columns);
        Assert.Contains("stable_key", columns);
        Assert.Contains("category", columns);
        Assert.Contains("subtype", columns);
        Assert.Contains("targets_json", columns);
        Assert.Contains("status", columns);
        Assert.Contains("reason", columns);
        Assert.Contains("last_seen_at", columns);
        Assert.True(await IndexExistsAsync(connection, "ux_collection_review_issue_states_collection_stable_key"));
        Assert.True(await IndexExistsAsync(connection, "IX_collection_review_issue_states_collection_id_category"));
        Assert.True(await IndexExistsAsync(connection, "IX_collection_review_issue_states_collection_id_status"));
        Assert.True(await IndexExistsAsync(connection, "IX_collection_review_issue_states_collection_id_category_status"));
    }
}
