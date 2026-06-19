using System.Data;
using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
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

    public static async Task EnsureReleaseTrackIdsAsync(
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
            await EnsureColumnAsync(
                connection,
                "release_tracks",
                "release_track_id",
                "ALTER TABLE release_tracks ADD COLUMN release_track_id TEXT;",
                afterAlterSql: null,
                afterAlterUpgradeKey: null,
                cancellationToken);

            await using DbCommand backfill = connection.CreateCommand();
            backfill.CommandText =
                """
                UPDATE release_tracks
                SET release_track_id =
                    lower(hex(randomblob(4))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(2))) || '-' ||
                    lower(hex(randomblob(6)))
                WHERE release_track_id IS NULL OR trim(release_track_id) = '';
                """;
            _ = await backfill.ExecuteNonQueryAsync(cancellationToken);

            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ix_release_tracks_collection_release_track_id ON release_tracks (collection_id, release_track_id);",
                cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    public static async Task EnsureTrackRelationParserRulesTableAsync(
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
            await using DbCommand createTable = connection.CreateCommand();
            createTable.CommandText =
                """
                CREATE TABLE IF NOT EXISTS track_relation_parser_rules (
                    id INTEGER NOT NULL CONSTRAINT pk_track_relation_parser_rules PRIMARY KEY AUTOINCREMENT,
                    track_relation_parser_rule_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    relation_type_code TEXT NOT NULL,
                    alias TEXT NOT NULL,
                    match_mode TEXT NOT NULL,
                    confidence INTEGER NOT NULL,
                    direction TEXT NOT NULL,
                    sort_order INTEGER NOT NULL,
                    is_active INTEGER NOT NULL,
                    is_builtin INTEGER NOT NULL,
                    CONSTRAINT ak_track_relation_parser_rules_collection_rule_id UNIQUE (collection_id, track_relation_parser_rule_id),
                    CONSTRAINT fk_track_relation_parser_rules_collections_collection_id FOREIGN KEY (collection_id) REFERENCES collections (collection_id) ON DELETE CASCADE
                );
                """;
            _ = await createTable.ExecuteNonQueryAsync(cancellationToken);

            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS IX_track_relation_parser_rules_collection_id_sort_order ON track_relation_parser_rules (collection_id, sort_order);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_track_relation_parser_rules_collection_type_alias_mode ON track_relation_parser_rules (collection_id, relation_type_code, alias, match_mode);",
                cancellationToken);
        }
        finally
        {
            if (shouldClose)
            {
                await connection.CloseAsync();
            }
        }
    }

    private static async Task EnsureIndexAsync(
        DbConnection connection,
        string createIndexSql,
        CancellationToken cancellationToken)
    {
        await using DbCommand command = connection.CreateCommand();
        command.CommandText = createIndexSql;
        _ = await command.ExecuteNonQueryAsync(cancellationToken);
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
