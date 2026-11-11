using System.Text.RegularExpressions;
using DiscWeave.Infrastructure.LocalDesktop;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class ArchiveSchemaMaintenanceTests
{
    [Fact(DisplayName = "The complete historical archive baseline upgrades with backup and remains current")]
    public async Task Historical_baseline_upgrades_and_remains_current()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync(HistoricalScript);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        ArchiveUpgradeResult result = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("upgraded", result.Status);
        Assert.NotNull(result.BackupDirectory);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectDatabaseAsync(
            Path.Combine(result.BackupDirectory, "data", "discweave.sqlite"))).Status);
        Assert.Equal("current", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        Assert.Equal("current", (await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings)).Status);
        _ = Assert.Single(await archive.Context.MusicCollections.ToArrayAsync());
    }

    [Theory(DisplayName = "Historical baseline near misses remain unsupported without backup or writes")]
    [InlineData("default")]
    [InlineData("index")]
    [InlineData("partial")]
    [InlineData("collation")]
    [InlineData("extra")]
    public async Task Historical_baseline_near_misses_fail_closed(string mutation)
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync(script =>
        {
            string historical = HistoricalScript(script);
            return mutation switch
            {
                "default" => historical.Replace("\"external_review_revision\" INTEGER NOT NULL DEFAULT 0", "\"external_review_revision\" INTEGER NOT NULL DEFAULT 1", StringComparison.Ordinal),
                "index" => historical.Replace("UNIQUE INDEX \"release_import_session_id\"", "INDEX \"release_import_session_id\"", StringComparison.Ordinal),
                "partial" => historical.Replace("DEFAULT 'mainArtist\nremixer'", "DEFAULT ('mainArtist' || (CHAR(10) || 'remixer'))", StringComparison.Ordinal),
                "collation" => historical.Replace("ON \"release_import_sessions\" (\"release_import_session_id\")", "ON \"release_import_sessions\" (\"release_import_session_id\" COLLATE NOCASE)", StringComparison.Ordinal),
                _ => historical + "\nCREATE TABLE unexpected_extension (id INTEGER);",
            };
        });
        Assert.Equal("unsupported", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        ArchiveUpgradeResult result = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("blocked", result.Status);
        Assert.Null(result.BackupDirectory);
        Assert.False(Directory.Exists(Path.Combine(archive.Root, "DiscWeave Backups")));
    }

    private static string HistoricalScript(string script)
    {
        script = script.Replace("DEFAULT ('mainArtist' || (CHAR(10) || 'remixer'))", "DEFAULT 'mainArtist\nremixer'", StringComparison.Ordinal);
        string[] integerDefaults = ["has_explicit_version_year", "is_original", "binding_promote_linked_target_confirmed", "external_review_revision", "is_selected_original_binding_valid"];
        foreach (string column in integerDefaults)
        {
            // Restrict this historic addition to import tables, not similarly named catalog columns.
            script = Regex.Replace(script, "(CREATE TABLE \"release_import_(?:drafts|draft_tracks)\" \\(.*?)(\"" + column + "\" INTEGER NOT NULL)([,\\r\\n])",
                "$1$2 DEFAULT 0$3", RegexOptions.Singleline);
        }

        script = HistoricalSourcesDefault().Replace(script,
            "$1$2 DEFAULT '[]'$3");
        var indexes = new List<string>();
        script = HistoricalImportTables().Replace(script,
            table => HistoricalUniqueConstraints().Replace(table.Value, constraint =>
            {
                indexes.Add($"CREATE UNIQUE INDEX \"{constraint.Groups[1].Value}\" ON \"{table.Groups[1].Value}\" ({constraint.Groups[2].Value});");
                return string.Empty;
            }));
        Assert.Equal(12, indexes.Count);
        return script + "\n" + string.Join("\n", indexes);
    }

    [GeneratedRegex("(CREATE TABLE \"release_import_draft_tracks\" \\(.*?)(\"external_sources_json\" TEXT NOT NULL)([,\\r\\n])", RegexOptions.Singleline)]
    private static partial Regex HistoricalSourcesDefault();

    [GeneratedRegex("CREATE TABLE \"(release_import_sessions|release_import_drafts|release_import_draft_tracks|release_import_relation_suggestions)\" \\(.*?\\n\\);", RegexOptions.Singleline)]
    private static partial Regex HistoricalImportTables();

    [GeneratedRegex(",\\n    CONSTRAINT \"([^\"]+)\" UNIQUE \\(([^)]+)\\)")]
    private static partial Regex HistoricalUniqueConstraints();
}
