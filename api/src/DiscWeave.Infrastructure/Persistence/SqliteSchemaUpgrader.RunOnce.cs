using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    private static async Task RunOnceAsync(
        DbConnection connection,
        string upgradeKey,
        string sql,
        CancellationToken cancellationToken)
    {
        if (await HasSchemaUpgradeRunAsync(connection, upgradeKey, cancellationToken))
        {
            return;
        }

        await using DbCommand command = connection.CreateCommand();
        command.CommandText = sql;
        _ = await command.ExecuteNonQueryAsync(cancellationToken);
        await MarkSchemaUpgradeRunAsync(connection, upgradeKey, cancellationToken);
    }
}
