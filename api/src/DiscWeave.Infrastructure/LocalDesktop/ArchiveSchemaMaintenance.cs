using System.Security.Cryptography;
using System.Text;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.LocalDesktop;

public static partial class ArchiveSchemaMaintenance
{
    public const string UpgradeId = "label-import-links-v1";
    private const string LedgerSql = "CREATE TABLE archive_schema_upgrades (upgrade_id TEXT NOT NULL PRIMARY KEY, applied_at TEXT NOT NULL, backup_directory TEXT NOT NULL)";
    private static readonly Lazy<Task<ExpectedSchema>> Expected = new(BuildExpectedAsync);
    private const int MaximumCachedSchemas = 16;
    private static readonly System.Threading.Lock StatusCacheLock = new();
    private static readonly Dictionary<string, ArchiveSchemaStatus> StatusCache = new(StringComparer.Ordinal);

    public static Task<ArchiveSchemaStatus> InspectAsync(string dataDirectory, CancellationToken cancellationToken = default)
    {
        return InspectDatabaseAsync(Path.Combine(dataDirectory, "discweave.sqlite"), cancellationToken);
    }

    public static async Task<ArchiveSchemaStatus> InspectDatabaseAsync(string databasePath, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!File.Exists(databasePath) || (File.GetAttributes(databasePath) & FileAttributes.ReparsePoint) != 0)
            {
                return Unsupported("schema.database_unavailable");
            }

            await using SqliteConnection connection = OpenConnection(databasePath, readOnly: true);
            await connection.OpenAsync(cancellationToken);
            using SqliteTransaction snapshot = connection.BeginTransaction(deferred: true);
            List<string[]> objects = await ArchiveSchemaSnapshot.RowsAsync(connection, "SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name", cancellationToken);
            string stamp = System.Text.Json.JsonSerializer.Serialize(objects);
            if (objects.Any(item => item[1] == ArchiveSchemaSnapshot.LedgerTable))
            {
                stamp += System.Text.Json.JsonSerializer.Serialize(await ArchiveSchemaSnapshot.RowsAsync(connection, "SELECT * FROM archive_schema_upgrades ORDER BY upgrade_id", cancellationToken));
            }

            string signature = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(stamp)));
            lock (StatusCacheLock)
            {
                if (StatusCache.TryGetValue(signature, out ArchiveSchemaStatus? cached))
                {
                    return cached;
                }
            }

            ArchiveSchemaStatus status = await InspectConnectionAsync(connection, cancellationToken);
            lock (StatusCacheLock)
            {
                if (StatusCache.Count >= MaximumCachedSchemas)
                {
                    StatusCache.Clear();
                }

                StatusCache[signature] = status;
            }

            return status;
        }
        catch (Exception exception) when (exception is SqliteException or IOException or UnauthorizedAccessException)
        {
            return Unsupported("schema.unreadable");
        }
    }

    private static async Task<ArchiveSchemaStatus> InspectConnectionAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        ExpectedSchema expected = await Expected.Value.WaitAsync(cancellationToken);
        Dictionary<string, string> actual = await ArchiveSchemaSnapshot.ReadAsync(connection, cancellationToken);
        bool hasLedger = actual.Remove(ArchiveSchemaSnapshot.LedgerTable, out string? ledger);
        if (hasLedger && (ledger != expected.Ledger || !await LedgerIsValidAsync(connection, cancellationToken)))
        {
            return Unsupported("schema.unsupported");
        }

        bool hasLinks = actual.ContainsKey(ArchiveSchemaSnapshot.LinkTable);
        int expectedCount = expected.Tables.Count - (hasLinks ? 0 : 1);
        return actual.Count != expectedCount || actual.Any(pair => !expected.Tables.TryGetValue(pair.Key, out string? value) || value != pair.Value) || (hasLedger && !hasLinks)
            ? Unsupported("schema.unsupported")
            : hasLinks
                ? new ArchiveSchemaStatus("current", UpgradeId, false, null)
                : new ArchiveSchemaStatus("upgradeRequired", UpgradeId, true, "schema.upgrade_required");
    }

    private static async Task<bool> LedgerIsValidAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        List<string[]> entries = await ArchiveSchemaSnapshot.RowsAsync(connection, "SELECT upgrade_id,applied_at,backup_directory FROM archive_schema_upgrades", cancellationToken);
        return entries.Count == 1 && entries[0][0] == UpgradeId &&
            DateTimeOffset.TryParse(entries[0][1], System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind, out _) &&
            !string.IsNullOrWhiteSpace(entries[0][2]) && Path.IsPathFullyQualified(entries[0][2]);
    }

    private static ArchiveSchemaStatus Unsupported(string code)
    {
        return new ArchiveSchemaStatus("unsupported", UpgradeId, false, code);
    }

    private static SqliteConnection OpenConnection(string path, bool readOnly)
    {
        return new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = path,
            Mode = readOnly ? SqliteOpenMode.ReadOnly : SqliteOpenMode.ReadWrite,
            Pooling = false,
            DefaultTimeout = 5,
            ForeignKeys = true,
        }.ToString());
    }

    private static async Task<ExpectedSchema> BuildExpectedAsync()
    {
        string directory = Path.Combine(Path.GetTempPath(), "discweave-schema-" + Guid.CreateVersion7().ToString("N"));
        _ = Directory.CreateDirectory(directory);
        string path = Path.Combine(directory, "expected.sqlite");
        try
        {
            DbContextOptions<DiscWeaveDbContext> options = new DbContextOptionsBuilder<DiscWeaveDbContext>().UseSqlite($"Data Source={path};Pooling=False").Options;
            await using (var context = new DiscWeaveDbContext(options))
            {
                _ = await context.Database.EnsureCreatedAsync();
            }

            await using SqliteConnection connection = OpenConnection(path, readOnly: false);
            await connection.OpenAsync();
            Dictionary<string, string> tables = await ArchiveSchemaSnapshot.ReadAsync(connection, CancellationToken.None);
            List<string[]> sql = await ArchiveSchemaSnapshot.RowsAsync(connection,
                "SELECT sql FROM sqlite_master WHERE tbl_name='label_import_session_links' AND sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END", CancellationToken.None);
            using SqliteCommand command = connection.CreateCommand();
            command.CommandText = LedgerSql;
            _ = await command.ExecuteNonQueryAsync();
            Dictionary<string, string> withLedger = await ArchiveSchemaSnapshot.ReadAsync(connection, CancellationToken.None);
            return new ExpectedSchema(tables, string.Join(";\n", sql.Select(row => row[0])) + ";", withLedger[ArchiveSchemaSnapshot.LedgerTable]);
        }
        finally
        {
            Directory.Delete(directory, recursive: true);
        }
    }


    private sealed record ExpectedSchema(Dictionary<string, string> Tables, string LinkSql, string Ledger);
}
