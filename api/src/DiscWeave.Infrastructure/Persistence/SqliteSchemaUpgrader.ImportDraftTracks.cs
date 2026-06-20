using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    public static async Task EnsureReleaseImportDraftTrackTechnicalColumnsAsync(
        DbConnection connection,
        CancellationToken cancellationToken = default)
    {
        await EnsureColumnAsync(
            connection,
            "release_import_draft_tracks",
            "codec",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN codec TEXT;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
        await EnsureColumnAsync(
            connection,
            "release_import_draft_tracks",
            "quality",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN quality TEXT;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
        await EnsureColumnAsync(
            connection,
            "release_import_draft_tracks",
            "bitrate_kbps",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN bitrate_kbps INTEGER;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
        await EnsureColumnAsync(
            connection,
            "release_import_draft_tracks",
            "sample_rate_hz",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN sample_rate_hz INTEGER;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
        await EnsureColumnAsync(
            connection,
            "release_import_draft_tracks",
            "channels",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN channels INTEGER;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
    }
}
