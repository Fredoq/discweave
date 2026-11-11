using DiscWeave.Infrastructure.LocalDesktop;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class ArchiveSchemaMaintenanceTests
{
    [Fact(DisplayName = "A changed link-table check constraint is not accepted as the current schema")]
    public async Task Changed_check_constraint_is_not_accepted()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        string script = File.ReadAllText(Path.Combine(Architecture.RepositoryRoot.Find().FullName, "docs", "backup", "add-label-import-session-links.sql"));
        _ = await archive.Context.Database.ExecuteSqlRawAsync(script.Replace("source_kind = 'LocalFiles'", "source_kind = 'ExternalMetadata'", StringComparison.Ordinal));
        Assert.Equal("unsupported", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        Assert.Equal("blocked", (await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings)).Status);
    }

    [Fact(DisplayName = "Shared settings roots are backed up and altered ledger rows invalidate cached status")]
    public async Task Shared_settings_are_backed_up_and_altered_ledger_invalidates_cache()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        await File.WriteAllTextAsync(Path.Combine(archive.Data, "watched-import-folders.json"), "shared-settings");
        ArchiveUpgradeResult upgraded = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Data);
        Assert.Equal("upgraded", upgraded.Status);
        Assert.NotNull(upgraded.BackupDirectory);
        Assert.Equal("shared-settings", await File.ReadAllTextAsync(Path.Combine(upgraded.BackupDirectory, "data", "watched-import-folders.json")));
        Assert.Equal("current", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        _ = await archive.Context.Database.ExecuteSqlRawAsync("UPDATE archive_schema_upgrades SET applied_at='invalid-timestamp'");
        Assert.Equal("unsupported", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        Assert.Equal("blocked", (await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Data)).Status);
    }

    [Fact(DisplayName = "A competing SQLite writer blocks upgrade without producing a backup")]
    public async Task Competing_sqlite_writer_blocks_upgrade_without_backup()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        await using var connection = new SqliteConnection($"Data Source={archive.Database};Pooling=False");
        await connection.OpenAsync();
        using SqliteCommand command = connection.CreateCommand();
        command.CommandText = "BEGIN IMMEDIATE";
        _ = await command.ExecuteNonQueryAsync();
        ArchiveUpgradeResult result = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("blocked", result.Status);
        Assert.Equal("schema.archive_busy", result.Code);
        Assert.Null(result.BackupDirectory);
        command.CommandText = "ROLLBACK";
        _ = await command.ExecuteNonQueryAsync();
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
    }
}
