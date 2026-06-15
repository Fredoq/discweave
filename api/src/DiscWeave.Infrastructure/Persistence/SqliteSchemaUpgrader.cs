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

    public static async Task EnsureReleaseImportRelationSuggestionsTableAsync(
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
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_release_import_drafts_collection_session_draft_id ON release_import_drafts (collection_id, release_import_session_id, release_import_draft_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_release_import_draft_tracks_collection_draft_track_id ON release_import_draft_tracks (collection_id, release_import_draft_id, release_import_draft_track_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_release_import_draft_tracks_collection_track_id ON release_import_draft_tracks (collection_id, release_import_draft_track_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_tracks_collection_track_id ON tracks (collection_id, track_id);",
                cancellationToken);

            await using DbCommand createTable = connection.CreateCommand();
            createTable.CommandText =
                """
                CREATE TABLE IF NOT EXISTS release_import_relation_suggestions (
                    id INTEGER NOT NULL CONSTRAINT pk_release_import_relation_suggestions PRIMARY KEY AUTOINCREMENT,
                    release_import_relation_suggestion_id TEXT NOT NULL,
                    collection_id TEXT NOT NULL,
                    release_import_session_id TEXT NOT NULL,
                    release_import_draft_id TEXT NOT NULL,
                    token TEXT NOT NULL,
                    confidence INTEGER NOT NULL,
                    decision TEXT NOT NULL,
                    suggested_source_kind TEXT NOT NULL,
                    suggested_source_track_id TEXT NOT NULL,
                    suggested_target_kind TEXT NULL,
                    suggested_target_track_id TEXT NULL,
                    suggested_target_draft_track_id TEXT NULL,
                    suggested_target_existing_track_id TEXT NULL,
                    suggested_relation_type_code TEXT NOT NULL,
                    reviewed_source_kind TEXT NOT NULL,
                    reviewed_source_track_id TEXT NOT NULL,
                    reviewed_target_kind TEXT NULL,
                    reviewed_target_track_id TEXT NULL,
                    reviewed_target_draft_track_id TEXT NULL,
                    reviewed_target_existing_track_id TEXT NULL,
                    reviewed_relation_type_code TEXT NOT NULL,
                    suggested_payload_json TEXT NOT NULL,
                    reviewed_payload_json TEXT NOT NULL,
                    CONSTRAINT release_import_relation_suggestion_id UNIQUE (release_import_relation_suggestion_id),
                    CONSTRAINT ak_release_import_relation_suggestions_collection_suggestion_id UNIQUE (collection_id, release_import_relation_suggestion_id),
                    CONSTRAINT ck_release_import_relation_suggestions_suggested_source_kind CHECK (suggested_source_kind = 'DraftTrack'),
                    CONSTRAINT ck_release_import_relation_suggestions_reviewed_source_kind CHECK (reviewed_source_kind = 'DraftTrack'),
                    CONSTRAINT ck_release_import_relation_suggestions_suggested_target_consistency CHECK (
                        (suggested_target_kind IS NULL AND suggested_target_track_id IS NULL AND suggested_target_draft_track_id IS NULL AND suggested_target_existing_track_id IS NULL) OR
                        (suggested_target_kind = 'DraftTrack' AND suggested_target_track_id IS NOT NULL AND suggested_target_draft_track_id = suggested_target_track_id AND suggested_target_existing_track_id IS NULL) OR
                        (suggested_target_kind = 'ExistingTrack' AND suggested_target_track_id IS NOT NULL AND suggested_target_existing_track_id = suggested_target_track_id AND suggested_target_draft_track_id IS NULL)
                    ),
                    CONSTRAINT ck_release_import_relation_suggestions_reviewed_target_consistency CHECK (
                        (reviewed_target_kind IS NULL AND reviewed_target_track_id IS NULL AND reviewed_target_draft_track_id IS NULL AND reviewed_target_existing_track_id IS NULL) OR
                        (reviewed_target_kind = 'DraftTrack' AND reviewed_target_track_id IS NOT NULL AND reviewed_target_draft_track_id = reviewed_target_track_id AND reviewed_target_existing_track_id IS NULL) OR
                        (reviewed_target_kind = 'ExistingTrack' AND reviewed_target_track_id IS NOT NULL AND reviewed_target_existing_track_id = reviewed_target_track_id AND reviewed_target_draft_track_id IS NULL)
                    ),
                    CONSTRAINT fk_release_import_relation_suggestions_release_import_drafts_collection_id_release_import_session_id_release_import_draft_id
                        FOREIGN KEY (collection_id, release_import_session_id, release_import_draft_id)
                        REFERENCES release_import_drafts (collection_id, release_import_session_id, release_import_draft_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_suggested_source_draft_tracks
                        FOREIGN KEY (collection_id, release_import_draft_id, suggested_source_track_id)
                        REFERENCES release_import_draft_tracks (collection_id, release_import_draft_id, release_import_draft_track_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_reviewed_source_draft_tracks
                        FOREIGN KEY (collection_id, release_import_draft_id, reviewed_source_track_id)
                        REFERENCES release_import_draft_tracks (collection_id, release_import_draft_id, release_import_draft_track_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_suggested_target_draft_tracks
                        FOREIGN KEY (collection_id, suggested_target_draft_track_id)
                        REFERENCES release_import_draft_tracks (collection_id, release_import_draft_track_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_reviewed_target_draft_tracks
                        FOREIGN KEY (collection_id, reviewed_target_draft_track_id)
                        REFERENCES release_import_draft_tracks (collection_id, release_import_draft_track_id)
                        ON DELETE CASCADE,
                    CONSTRAINT fk_release_import_relation_suggestions_suggested_target_tracks
                        FOREIGN KEY (collection_id, suggested_target_existing_track_id)
                        REFERENCES tracks (collection_id, track_id)
                        ON DELETE RESTRICT,
                    CONSTRAINT fk_release_import_relation_suggestions_reviewed_target_tracks
                        FOREIGN KEY (collection_id, reviewed_target_existing_track_id)
                        REFERENCES tracks (collection_id, track_id)
                        ON DELETE RESTRICT
                );
                """;
            _ = await createTable.ExecuteNonQueryAsync(cancellationToken);

            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_release_import_session_id ON release_import_relation_suggestions (collection_id, release_import_session_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_release_import_draft_id ON release_import_relation_suggestions (collection_id, release_import_draft_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_release_import_session_id_release_import_draft_id ON release_import_relation_suggestions (collection_id, release_import_session_id, release_import_draft_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_suggested_source_track_id ON release_import_relation_suggestions (collection_id, suggested_source_track_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_suggested_target_track_id ON release_import_relation_suggestions (collection_id, suggested_target_track_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_reviewed_source_track_id ON release_import_relation_suggestions (collection_id, reviewed_source_track_id);",
                cancellationToken);
            await EnsureIndexAsync(
                connection,
                "CREATE INDEX IF NOT EXISTS IX_release_import_relation_suggestions_collection_id_reviewed_target_track_id ON release_import_relation_suggestions (collection_id, reviewed_target_track_id);",
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
