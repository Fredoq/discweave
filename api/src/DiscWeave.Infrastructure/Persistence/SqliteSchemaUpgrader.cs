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
            afterAlterUpgradeKey: null,
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
            "release_import_draft_tracks.inherit_release_artist_credits.backfill",
            cancellationToken);
    }

    private static async Task EnsureColumnAsync(
        DbConnection connection,
        string tableName,
        string columnName,
        string alterSql,
        string? afterAlterSql,
        string? afterAlterUpgradeKey,
        CancellationToken cancellationToken)
    {
        bool shouldClose = connection.State != ConnectionState.Open;
        if (shouldClose)
        {
            await connection.OpenAsync(cancellationToken);
        }

        try
        {
            bool columnExists = false;
            await using DbCommand tableInfo = connection.CreateCommand();
            tableInfo.CommandText = "SELECT name FROM pragma_table_info($tableName);";
            DbParameter tableParameter = tableInfo.CreateParameter();
            tableParameter.ParameterName = "$tableName";
            tableParameter.Value = tableName;
            _ = tableInfo.Parameters.Add(tableParameter);
            await using DbDataReader reader = await tableInfo.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(reader.GetString(0), columnName, StringComparison.Ordinal))
                {
                    columnExists = true;
                    break;
                }
            }

            if (!columnExists)
            {
                await using DbCommand alter = connection.CreateCommand();
                alter.CommandText = alterSql;
                _ = await alter.ExecuteNonQueryAsync(cancellationToken);
            }

            if (!string.IsNullOrWhiteSpace(afterAlterSql) &&
                !string.IsNullOrWhiteSpace(afterAlterUpgradeKey) &&
                !await HasSchemaUpgradeRunAsync(connection, afterAlterUpgradeKey, cancellationToken))
            {
                await using DbCommand afterAlter = connection.CreateCommand();
                afterAlter.CommandText = afterAlterSql;
                _ = await afterAlter.ExecuteNonQueryAsync(cancellationToken);
                await MarkSchemaUpgradeRunAsync(connection, afterAlterUpgradeKey, cancellationToken);
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

    private static async Task<bool> HasSchemaUpgradeRunAsync(
        DbConnection connection,
        string upgradeKey,
        CancellationToken cancellationToken)
    {
        await EnsureSchemaUpgradeHistoryTableAsync(connection, cancellationToken);
        await using DbCommand command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM schema_upgrades WHERE upgrade_key = $upgradeKey LIMIT 1;";
        DbParameter parameter = command.CreateParameter();
        parameter.ParameterName = "$upgradeKey";
        parameter.Value = upgradeKey;
        _ = command.Parameters.Add(parameter);

        return await command.ExecuteScalarAsync(cancellationToken) is not null;
    }

    private static async Task MarkSchemaUpgradeRunAsync(
        DbConnection connection,
        string upgradeKey,
        CancellationToken cancellationToken)
    {
        await EnsureSchemaUpgradeHistoryTableAsync(connection, cancellationToken);
        await using DbCommand command = connection.CreateCommand();
        command.CommandText = "INSERT OR IGNORE INTO schema_upgrades (upgrade_key, applied_at) VALUES ($upgradeKey, $appliedAt);";
        DbParameter keyParameter = command.CreateParameter();
        keyParameter.ParameterName = "$upgradeKey";
        keyParameter.Value = upgradeKey;
        _ = command.Parameters.Add(keyParameter);

        DbParameter appliedAtParameter = command.CreateParameter();
        appliedAtParameter.ParameterName = "$appliedAt";
        appliedAtParameter.Value = DateTimeOffset.UtcNow.ToString("O");
        _ = command.Parameters.Add(appliedAtParameter);

        _ = await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task EnsureSchemaUpgradeHistoryTableAsync(
        DbConnection connection,
        CancellationToken cancellationToken)
    {
        await using DbCommand command = connection.CreateCommand();
        command.CommandText =
            """
            CREATE TABLE IF NOT EXISTS schema_upgrades (
                upgrade_key TEXT NOT NULL PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            """;
        _ = await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
