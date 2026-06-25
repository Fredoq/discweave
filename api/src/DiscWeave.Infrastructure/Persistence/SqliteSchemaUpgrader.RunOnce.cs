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
        await EnsureSchemaUpgradeHistoryTableAsync(connection, cancellationToken);
        await using DbTransaction transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using DbCommand claim = connection.CreateCommand();
        claim.Transaction = transaction;
        claim.CommandText = "INSERT OR IGNORE INTO schema_upgrades (upgrade_key, applied_at) VALUES ($upgradeKey, $appliedAt);";
        DbParameter keyParameter = claim.CreateParameter();
        keyParameter.ParameterName = "$upgradeKey";
        keyParameter.Value = upgradeKey;
        _ = claim.Parameters.Add(keyParameter);

        DbParameter appliedAtParameter = claim.CreateParameter();
        appliedAtParameter.ParameterName = "$appliedAt";
        appliedAtParameter.Value = DateTimeOffset.UtcNow.ToString("O");
        _ = claim.Parameters.Add(appliedAtParameter);

        if (await claim.ExecuteNonQueryAsync(cancellationToken) == 0)
        {
            await transaction.CommitAsync(cancellationToken);
            return;
        }

        await using DbCommand command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        _ = await command.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
