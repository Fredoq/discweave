using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static class SqliteSchemaUpgrader
{
    public static async Task EnsureReleaseImportDraftExternalSourcesColumnAsync(
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
            await using DbCommand tableInfo = connection.CreateCommand();
            tableInfo.CommandText = "PRAGMA table_info(release_import_drafts);";
            await using DbDataReader reader = await tableInfo.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                if (string.Equals(reader.GetString(1), "external_sources_json", StringComparison.Ordinal))
                {
                    return;
                }
            }

            await using DbCommand alter = connection.CreateCommand();
            alter.CommandText = "ALTER TABLE release_import_drafts ADD COLUMN external_sources_json TEXT NOT NULL DEFAULT '[]';";
            _ = await alter.ExecuteNonQueryAsync(cancellationToken);
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
