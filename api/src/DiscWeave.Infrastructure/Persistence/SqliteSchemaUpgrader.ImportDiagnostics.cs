using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    public static async Task EnsureReleaseImportScanDiagnosticsTableAsync(
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
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_release_import_sessions_collection_session_id ON release_import_sessions (collection_id, release_import_session_id);",
                cancellationToken);

            await using DbCommand createTable = connection.CreateCommand();
            createTable.CommandText =
                """
                CREATE TABLE IF NOT EXISTS release_import_scan_diagnostics (
                    id INTEGER NOT NULL CONSTRAINT pk_release_import_scan_diagnostics PRIMARY KEY AUTOINCREMENT,
                    release_import_scan_diagnostic_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_import_session_id TEXT NOT NULL,
                    code TEXT NOT NULL,
                    severity TEXT NOT NULL,
                    message TEXT NOT NULL,
                    file_path TEXT NOT NULL,
                    relative_path TEXT NOT NULL,
                    extension TEXT NULL,
                    size_bytes INTEGER NULL,
                    source TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    CONSTRAINT release_import_scan_diagnostic_id UNIQUE (release_import_scan_diagnostic_id),
                    CONSTRAINT ak_release_import_scan_diagnostics_collection_diagnostic_id UNIQUE (collection_id, release_import_scan_diagnostic_id),
                    CONSTRAINT fk_release_import_scan_diagnostics_sessions_collection_id_release_import_session_id
                        FOREIGN KEY (collection_id, release_import_session_id)
                        REFERENCES release_import_sessions (collection_id, release_import_session_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_scan_diagnostics_collections_collection_id
                        FOREIGN KEY (collection_id)
                        REFERENCES collections (collection_id)
                        ON DELETE CASCADE
                );
                """;
            _ = await createTable.ExecuteNonQueryAsync(cancellationToken);

            await EnsureScanDiagnosticIndexesAsync(connection, cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task EnsureScanDiagnosticIndexesAsync(
        DbConnection connection,
        CancellationToken cancellationToken)
    {
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_scan_diagnostics_collection_id_release_import_session_id ON release_import_scan_diagnostics (collection_id, release_import_session_id);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_scan_diagnostics_collection_id_code ON release_import_scan_diagnostics (collection_id, code);",
            cancellationToken);
        await EnsureIndexAsync(
            connection,
            "CREATE INDEX IF NOT EXISTS IX_release_import_scan_diagnostics_collection_id_severity ON release_import_scan_diagnostics (collection_id, severity);",
            cancellationToken);
    }
}
