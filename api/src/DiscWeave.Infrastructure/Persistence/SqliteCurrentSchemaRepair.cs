using System.Data.Common;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Persistence;

public static class SqliteCurrentSchemaRepair
{
    public static async Task ApplyAsync(DiscWeaveDbContext context, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(context);

        DbConnection connection = context.Database.GetDbConnection();
        await ApplyAsync(connection, cancellationToken);
    }

    public static async Task ApplyAsync(DbConnection connection, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(connection);

        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using DbTransaction transaction = await connection.BeginTransactionAsync(cancellationToken);
        await RepairIdentityKeyAsync(
            connection,
            transaction,
            "artist_relations",
            "source_artist_id || '|' || target_artist_id || '|' || type || '|' || COALESCE(CAST(period_start_year AS TEXT), 'none') || '|' || COALESCE(CAST(period_end_year AS TEXT), 'none')",
            "ux_artist_relations_collection_identity",
            cancellationToken);
        await RepairIdentityKeyAsync(
            connection,
            transaction,
            "track_relations",
            "source_track_id || '|' || target_track_id || '|' || relation_type",
            "ux_track_relations_collection_identity",
            cancellationToken);
        await RepairCreditIdentityKeysAsync(connection, transaction, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    private static async Task RepairIdentityKeyAsync(
        DbConnection connection,
        DbTransaction transaction,
        string tableName,
        string valueExpression,
        string indexName,
        CancellationToken cancellationToken)
    {
        if (!await ColumnExistsAsync(connection, transaction, tableName, "identity_key", cancellationToken))
        {
            await ExecuteAsync(connection, transaction, $"ALTER TABLE {tableName} ADD COLUMN identity_key TEXT NOT NULL DEFAULT ''", cancellationToken);
        }

        await ExecuteAsync(connection, transaction, $"UPDATE {tableName} SET identity_key = {valueExpression}", cancellationToken);
        await CreateUniqueIndexIfCleanAsync(connection, transaction, tableName, indexName, cancellationToken);
    }

    private static async Task RepairCreditIdentityKeysAsync(
        DbConnection connection,
        DbTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string tableName = "credits";
        if (!await ColumnExistsAsync(connection, transaction, tableName, "identity_key", cancellationToken))
        {
            await ExecuteAsync(connection, transaction, "ALTER TABLE credits ADD COLUMN identity_key TEXT NOT NULL DEFAULT ''", cancellationToken);
        }

        await using DbCommand select = CreateCommand(
            connection,
            transaction,
            """
            SELECT id, target_type, target_release_id, target_track_id, contributor_artist_id, roles_json
            FROM credits
            """);
        List<CreditIdentityRow> rows = [];
        await using (DbDataReader reader = await select.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
            {
                rows.Add(new CreditIdentityRow(
                    reader.GetInt64(0),
                    reader.GetString(1),
                    reader.IsDBNull(2) ? null : reader.GetString(2),
                    reader.IsDBNull(3) ? null : reader.GetString(3),
                    reader.GetString(4),
                    reader.GetString(5)));
            }
        }

        foreach (CreditIdentityRow row in rows)
        {
            await UpdateCreditIdentityKeyAsync(connection, transaction, row, cancellationToken);
        }

        await CreateUniqueIndexIfCleanAsync(connection, transaction, tableName, "ux_credits_collection_identity", cancellationToken);
    }

    private static async Task UpdateCreditIdentityKeyAsync(
        DbConnection connection,
        DbTransaction transaction,
        CreditIdentityRow row,
        CancellationToken cancellationToken)
    {
        await using DbCommand command = CreateCommand(
            connection,
            transaction,
            "UPDATE credits SET identity_key = @identityKey WHERE id = @id");
        AddParameter(command, "@identityKey", CreateCreditIdentityKey(row));
        AddParameter(command, "@id", row.Id);
        _ = await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string CreateCreditIdentityKey(CreditIdentityRow row)
    {
        string? targetId = string.Equals(row.TargetType, "release", StringComparison.Ordinal)
            ? row.TargetReleaseId
            : row.TargetTrackId;
        string roles = string.Join(
            ',',
            ReadRoles(row.RolesJson)
                .Select(role => role.Trim())
                .Where(role => role.Length > 0)
                .Order(StringComparer.Ordinal));

        return string.Join('|', row.TargetType, targetId ?? string.Empty, row.ContributorArtistId, roles);
    }

    private static string[] ReadRoles(string rolesJson)
    {
        try
        {
            return JsonSerializer.Deserialize<string[]>(rolesJson) ?? [];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static async Task CreateUniqueIndexIfCleanAsync(
        DbConnection connection,
        DbTransaction transaction,
        string tableName,
        string indexName,
        CancellationToken cancellationToken)
    {
        await using DbCommand duplicates = CreateCommand(
            connection,
            transaction,
            $"SELECT 1 FROM {tableName} GROUP BY collection_id, identity_key HAVING COUNT(*) > 1 LIMIT 1");
        object? duplicateExists = await duplicates.ExecuteScalarAsync(cancellationToken);
        if (duplicateExists is not null)
        {
            return;
        }

        await ExecuteAsync(
            connection,
            transaction,
            $"CREATE UNIQUE INDEX IF NOT EXISTS {indexName} ON {tableName}(collection_id, identity_key)",
            cancellationToken);
    }

    private static async Task<bool> ColumnExistsAsync(
        DbConnection connection,
        DbTransaction transaction,
        string tableName,
        string columnName,
        CancellationToken cancellationToken)
    {
        await using DbCommand command = CreateCommand(connection, transaction, $"PRAGMA table_info({tableName})");
        await using DbDataReader reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (string.Equals(reader.GetString(1), columnName, StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    private static async Task ExecuteAsync(
        DbConnection connection,
        DbTransaction transaction,
        string sql,
        CancellationToken cancellationToken)
    {
        await using DbCommand command = CreateCommand(connection, transaction, sql);
        _ = await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static DbCommand CreateCommand(DbConnection connection, DbTransaction transaction, string sql)
    {
        DbCommand command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = sql;
        return command;
    }

    private static void AddParameter(DbCommand command, string name, object value)
    {
        DbParameter parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.Value = value;
        _ = command.Parameters.Add(parameter);
    }

    private sealed record CreditIdentityRow(
        long Id,
        string TargetType,
        string? TargetReleaseId,
        string? TargetTrackId,
        string ContributorArtistId,
        string RolesJson);
}
