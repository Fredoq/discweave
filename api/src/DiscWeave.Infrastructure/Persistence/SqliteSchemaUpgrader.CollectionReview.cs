using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    public static async Task EnsureCollectionReviewIssueStatesTableAsync(
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
            await using DbCommand createTable = connection.CreateCommand();
            createTable.CommandText =
                """
                CREATE TABLE IF NOT EXISTS collection_review_issue_states (
                    id INTEGER NOT NULL CONSTRAINT pk_collection_review_issue_states PRIMARY KEY AUTOINCREMENT,
                    collection_review_issue_state_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    stable_key TEXT NOT NULL,
                    category TEXT NOT NULL,
                    subtype TEXT NOT NULL,
                    title TEXT NOT NULL,
                    source_detector TEXT NOT NULL,
                    targets_json TEXT NOT NULL,
                    status TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    resolved_at TEXT NULL,
                    note TEXT NULL,
                    CONSTRAINT ak_collection_review_issue_states_collection_state_id UNIQUE (collection_id, collection_review_issue_state_id),
                    CONSTRAINT fk_collection_review_issue_states_collections_collection_id FOREIGN KEY (collection_id) REFERENCES collections (collection_id) ON DELETE CASCADE
                );
                """;
            _ = await createTable.ExecuteNonQueryAsync(cancellationToken);

            await EnsureCollectionReviewIssueStateIndexesAsync(connection, cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task EnsureCollectionReviewIssueStateIndexesAsync(
        DbConnection connection,
        CancellationToken cancellationToken)
    {
        await EnsureIndexAsync(
            connection,
            "CREATE UNIQUE INDEX IF NOT EXISTS ux_collection_review_issue_states_collection_stable_key ON collection_review_issue_states (collection_id, stable_key);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_collection_review_issue_states_collection_id_category ON collection_review_issue_states (collection_id, category);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_collection_review_issue_states_collection_id_status ON collection_review_issue_states (collection_id, status);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_collection_review_issue_states_collection_id_category_status ON collection_review_issue_states (collection_id, category, status);",
            cancellationToken);
    }
}
