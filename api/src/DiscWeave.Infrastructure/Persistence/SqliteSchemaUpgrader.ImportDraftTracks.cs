using System.Data.Common;

namespace DiscWeave.Infrastructure.Persistence;

public static partial class SqliteSchemaUpgrader
{
    private const string ReleaseImportDraftTracksTable = "release_import_draft_tracks";

    public static async Task EnsureReleaseImportDraftTrackTechnicalColumnsAsync(
        DbConnection connection,
        CancellationToken cancellationToken = default)
    {
        await EnsureColumnAsync(
            connection,
            ReleaseImportDraftTracksTable,
            "codec",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN codec TEXT;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
        await EnsureColumnAsync(
            connection,
            ReleaseImportDraftTracksTable,
            "quality",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN quality TEXT;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
        await EnsureColumnAsync(
            connection,
            ReleaseImportDraftTracksTable,
            "bitrate_kbps",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN bitrate_kbps INTEGER;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
        await EnsureColumnAsync(
            connection,
            ReleaseImportDraftTracksTable,
            "sample_rate_hz",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN sample_rate_hz INTEGER;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
        await EnsureColumnAsync(
            connection,
            ReleaseImportDraftTracksTable,
            "channels",
            "ALTER TABLE release_import_draft_tracks ADD COLUMN channels INTEGER;",
            afterAlterSql: null,
            afterAlterUpgradeKey: null,
            cancellationToken);
    }
}
