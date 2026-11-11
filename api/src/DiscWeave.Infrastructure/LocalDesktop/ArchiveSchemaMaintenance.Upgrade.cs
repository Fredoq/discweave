using System.Globalization;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.LocalDesktop;

public static partial class ArchiveSchemaMaintenance
{
    public static async Task<ArchiveUpgradeResult> UpgradeAsync(string dataDirectory, string settingsDirectory, CancellationToken cancellationToken = default)
    {
        string? backup = null;
        string failureCode = "schema.archive_unavailable";
        try
        {
            ValidateDirectories(dataDirectory, settingsDirectory);
            failureCode = "schema.archive_busy";
            using IDisposable lease = ArchiveMaintenanceLease.Acquire(dataDirectory);
            failureCode = "schema.database_unavailable";
            string databasePath = Path.Combine(dataDirectory, "discweave.sqlite");
            if (!File.Exists(databasePath) || (File.GetAttributes(databasePath) & FileAttributes.ReparsePoint) != 0)
            {
                return new ArchiveUpgradeResult("blocked", failureCode, null);
            }

            await using SqliteConnection connection = OpenConnection(databasePath, readOnly: false);
            await connection.OpenAsync(cancellationToken);
            using SqliteCommand command = connection.CreateCommand();
            failureCode = "schema.archive_busy";
            command.CommandText = "BEGIN IMMEDIATE";
            _ = await command.ExecuteNonQueryAsync(cancellationToken);
            bool committed = false;
            try
            {
                ArchiveSchemaStatus status = await InspectConnectionAsync(connection, cancellationToken);
                if (status.Status == "current")
                {
                    return new ArchiveUpgradeResult("current", null, null);
                }

                if (status.Status != "upgradeRequired")
                {
                    return new ArchiveUpgradeResult("blocked", status.Code, null);
                }

                if (!await HasValidIntegrityAsync(connection, cancellationToken))
                {
                    return new ArchiveUpgradeResult("blocked", "schema.integrity_failed", null);
                }

                failureCode = "schema.backup_failed";
                backup = await ArchiveBackup.CreateAsync(dataDirectory, settingsDirectory, databasePath, cancellationToken);
                failureCode = "schema.upgrade_failed";
                ExpectedSchema expected = await Expected.Value.WaitAsync(cancellationToken);
                command.CommandText = expected.LinkSql + "\n" + LedgerSql;
                _ = await command.ExecuteNonQueryAsync(cancellationToken);
                command.CommandText = "INSERT INTO archive_schema_upgrades (upgrade_id,applied_at,backup_directory) VALUES ($id,$at,$backup)";
                _ = command.Parameters.AddWithValue("$id", UpgradeId);
                _ = command.Parameters.AddWithValue("$at", DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture));
                _ = command.Parameters.AddWithValue("$backup", backup);
                _ = await command.ExecuteNonQueryAsync(cancellationToken);
                ArchiveSchemaStatus upgraded = await InspectConnectionAsync(connection, cancellationToken);
                if (upgraded.Status != "current" || !await HasValidIntegrityAsync(connection, cancellationToken))
                {
                    return new ArchiveUpgradeResult("blocked", "schema.validation_failed", backup);
                }

                cancellationToken.ThrowIfCancellationRequested();
                command.Parameters.Clear();
                command.CommandText = "COMMIT";
                _ = await command.ExecuteNonQueryAsync(cancellationToken);
                committed = true;
                return new ArchiveUpgradeResult("upgraded", null, backup);
            }
            finally
            {
                if (!committed)
                {
                    command.Parameters.Clear();
                    command.CommandText = "ROLLBACK";
                    try
                    {
                        _ = await command.ExecuteNonQueryAsync(CancellationToken.None);
                    }
                    catch (SqliteException exception) when (exception.SqliteErrorCode == 1)
                    {
                        // SQLite may already have rolled the transaction back on failure.
                    }
                }
            }
        }
        catch (OperationCanceledException) when (backup is not null)
        {
            return new ArchiveUpgradeResult("blocked", "archive.cancelled", backup);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or SqliteException or ArgumentException or JsonException)
        {
            return new ArchiveUpgradeResult("blocked", failureCode, backup);
        }
    }

    private static void ValidateDirectories(string dataDirectory, string settingsDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(dataDirectory);
        ArgumentException.ThrowIfNullOrWhiteSpace(settingsDirectory);
        string data = Path.TrimEndingDirectorySeparator(Path.GetFullPath(dataDirectory));
        string settings = Path.TrimEndingDirectorySeparator(Path.GetFullPath(settingsDirectory));
        if (!Directory.Exists(data) || !Directory.Exists(settings) ||
            (File.GetAttributes(data) & FileAttributes.ReparsePoint) != 0 ||
            (File.GetAttributes(settings) & FileAttributes.ReparsePoint) != 0 ||
            (data != settings && (data.StartsWith(settings + Path.DirectorySeparatorChar, StringComparison.Ordinal) || settings.StartsWith(data + Path.DirectorySeparatorChar, StringComparison.Ordinal))))
        {
            throw new IOException("Archive and settings directories are not safe for backup");
        }
    }

    internal static async Task<bool> HasValidIntegrityAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        List<string[]> integrity = await ArchiveSchemaSnapshot.RowsAsync(connection, "PRAGMA integrity_check", cancellationToken);
        List<string[]> foreignKeys = await ArchiveSchemaSnapshot.RowsAsync(connection, "PRAGMA foreign_key_check", cancellationToken);
        return integrity.Count == 1 && integrity[0][0] == "ok" && foreignKeys.Count == 0;
    }
}
