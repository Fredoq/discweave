using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class SqliteSchemaUpgraderTests
{
    [Fact(DisplayName = "SQLite schema upgrade creates import scan diagnostics table")]
    public async Task Sqlite_schema_upgrade_creates_import_scan_diagnostics_table()
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

                CREATE TABLE release_import_sessions (
                    id INTEGER PRIMARY KEY,
                    release_import_session_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL
                );
                """;
            _ = await create.ExecuteNonQueryAsync();
        }

        await SqliteSchemaUpgrader.EnsureReleaseImportScanDiagnosticsTableAsync(connection);
        string[] columns = [.. await ReadColumnNamesAsync(connection, "release_import_scan_diagnostics")];

        Assert.Contains("release_import_scan_diagnostic_id", columns);
        Assert.Contains("collection_id", columns);
        Assert.Contains("release_import_session_id", columns);
        Assert.Contains("code", columns);
        Assert.Contains("severity", columns);
        Assert.Contains("message", columns);
        Assert.Contains("file_path", columns);
        Assert.Contains("relative_path", columns);
        Assert.Contains("extension", columns);
        Assert.Contains("size_bytes", columns);
        Assert.Contains("source", columns);
        Assert.Contains("created_at", columns);
        Assert.True(await IndexExistsAsync(connection, "ux_release_import_sessions_collection_session_id"));
        Assert.True(await IndexExistsAsync(connection, "IX_release_import_scan_diagnostics_collection_id_release_import_session_id"));
        Assert.True(await IndexExistsAsync(connection, "IX_release_import_scan_diagnostics_collection_id_code"));
        Assert.True(await IndexExistsAsync(connection, "IX_release_import_scan_diagnostics_collection_id_severity"));

        await AssertImportScanDiagnosticInsertAsync(connection);
    }

    private static async Task AssertImportScanDiagnosticInsertAsync(SqliteConnection connection)
    {
        await using (SqliteCommand pragma = connection.CreateCommand())
        {
            pragma.CommandText = "PRAGMA foreign_keys = ON;";
            _ = await pragma.ExecuteNonQueryAsync();
        }

        string collectionId = Guid.NewGuid().ToString();
        string sessionId = Guid.NewGuid().ToString();
        string diagnosticId = Guid.NewGuid().ToString();

        await using SqliteCommand insert = connection.CreateCommand();
        insert.CommandText =
            """
            INSERT INTO collections (collection_id, name)
            VALUES ($collectionId, 'Default');

            INSERT INTO release_import_sessions (release_import_session_id, collection_id)
            VALUES ($sessionId, $collectionId);

            INSERT INTO release_import_scan_diagnostics (
                release_import_scan_diagnostic_id,
                collection_id,
                release_import_session_id,
                code,
                severity,
                message,
                file_path,
                relative_path,
                extension,
                size_bytes,
                source,
                created_at)
            VALUES (
                $diagnosticId,
                $collectionId,
                $sessionId,
                'unsupported_extension',
                'Info',
                'Import scanner skipped an unsupported file extension.',
                '/music/Release/notes.txt',
                'Release/notes.txt',
                '.txt',
                120,
                'scanner',
                '2026-06-20T12:00:00+00:00');
            """;
        _ = insert.Parameters.AddWithValue("$collectionId", collectionId);
        _ = insert.Parameters.AddWithValue("$sessionId", sessionId);
        _ = insert.Parameters.AddWithValue("$diagnosticId", diagnosticId);

        Assert.True((await insert.ExecuteNonQueryAsync()) > 0);
    }
}
