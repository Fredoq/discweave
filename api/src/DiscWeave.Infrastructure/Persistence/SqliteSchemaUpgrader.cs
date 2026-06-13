using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static class SqliteSchemaUpgrader
{
    public static async Task EnsureReleaseImportDraftExternalSourcesColumnAsync(
        DbConnection connection,
        CancellationToken cancellationToken = default)
    {
        await EnsureColumnAsync(
            connection,
            "release_import_drafts",
            "external_sources_json",
            "ALTER TABLE release_import_drafts ADD COLUMN external_sources_json TEXT NOT NULL DEFAULT '[]';",
            afterAlterSql: null,
            cancellationToken);
    }

    public static async Task EnsureReleaseImportDraftTrackInheritanceColumnAsync(
        DbConnection connection,
        CancellationToken cancellationToken = default)
    {
        await EnsureColumnAsync(
            connection,
            "release_import_draft_tracks",
            "inherit_release_artist_credits",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN inherit_release_artist_credits INTEGER NOT NULL DEFAULT 0;",
            "UPDATE release_import_draft_tracks SET inherit_release_artist_credits = 1 WHERE artist_credits_json = '[]' AND artist_names_json = '[]';",
            cancellationToken);
    }

    private static async Task EnsureColumnAsync(
        DbConnection connection,
        string tableName,
        string columnName,
        string alterSql,
        string? afterAlterSql,
        CancellationToken cancellationToken)
    {
        bool shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            await using DbCommand tableInfo = connection.CreateCommand();
            tableInfo.CommandText = $"PRAGMA table_info({tableName});";
            await using DbDataReader reader = await tableInfo.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(reader.GetString(1), columnName, StringComparison.Ordinal))
                {
                    return;
                }
            }

            await using DbCommand alter = connection.CreateCommand();
            alter.CommandText = alterSql;
            _ = await alter.ExecuteNonQueryAsync(cancellationToken);
            if (!string.IsNullOrWhiteSpace(afterAlterSql))
            {
                await using DbCommand afterAlter = connection.CreateCommand();
                afterAlter.CommandText = afterAlterSql;
                _ = await afterAlter.ExecuteNonQueryAsync(cancellationToken);
            }
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
