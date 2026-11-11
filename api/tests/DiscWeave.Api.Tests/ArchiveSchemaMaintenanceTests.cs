using System.Text.Json;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.LocalDesktop;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class ArchiveSchemaMaintenanceTests
{
    [Fact(DisplayName = "Archive upgrade backs up committed WAL data and durable settings before adding schema")]
    public async Task Upgrade_backs_up_WAL_data_and_settings_before_schema_change()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        await archive.Context.Database.OpenConnectionAsync();
        _ = await archive.Context.Database.ExecuteSqlRawAsync("PRAGMA wal_autocheckpoint=0");
        var label = Label.Create(archive.Collection, LabelId.New(), "WAL marker");
        _ = archive.Context.Labels.Add(label);
        _ = await archive.Context.SaveChangesAsync();
        Assert.True(new FileInfo(archive.Database + "-wal").Length > 0);
        ArchiveSchemaStatus before = await ArchiveSchemaMaintenance.InspectAsync(archive.Data);
        Assert.Equal("upgradeRequired", before.Status);
        ArchiveUpgradeResult result = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("upgraded", result.Status);
        Assert.NotNull(result.BackupDirectory);
        string backupDatabase = Path.Combine(result.BackupDirectory, "data", "discweave.sqlite");
        await using DiscWeaveDbContext backup = ArchiveFixture.OpenContext(backupDatabase);
        Assert.Equal("WAL marker", Assert.Single(await backup.Labels.ToArrayAsync()).Name);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectDatabaseAsync(backupDatabase)).Status);
        Assert.Equal("cover-data", await File.ReadAllTextAsync(Path.Combine(result.BackupDirectory, "data", "artifacts", "cover.txt")));
        Assert.Equal("settings-data", await File.ReadAllTextAsync(Path.Combine(result.BackupDirectory, "settings", "watched-import-folders.json")));
        using var manifest = JsonDocument.Parse(await File.ReadAllTextAsync(Path.Combine(result.BackupDirectory, "manifest.json")));
        Assert.True(manifest.RootElement.GetProperty("Files").TryGetProperty("data/discweave.sqlite", out _));
        Assert.True(manifest.RootElement.GetProperty("IncludedEntries").GetProperty("settings/watched-import-folders.json").GetBoolean());
        Assert.False(File.Exists(Path.Combine(result.BackupDirectory, "settings", "Chromium-cache")));
        Assert.Equal("current", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        ArchiveUpgradeResult repeat = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("current", repeat.Status);
        Assert.Null(repeat.BackupDirectory);
        _ = Assert.Single(Directory.GetDirectories(Path.Combine(archive.Root, "DiscWeave Backups")));
    }

    [Theory(DisplayName = "Unrecognized archive schema changes are rejected without backup or mutation")]
    [InlineData("CREATE TABLE unrecognized_extension (id INTEGER PRIMARY KEY)")]
    [InlineData("CREATE INDEX unexpected_label_index ON labels(name)")]
    [InlineData("CREATE TABLE archive_schema_upgrades (id INTEGER PRIMARY KEY)")]
    public async Task Unknown_schemas_are_rejected_without_mutation(string sql)
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        _ = await archive.Context.Database.ExecuteSqlRawAsync(sql);
        Assert.Equal("unsupported", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        ArchiveUpgradeResult result = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("blocked", result.Status);
        Assert.Equal("schema.unsupported", result.Code);
        Assert.Null(result.BackupDirectory);
        Assert.False(Directory.Exists(Path.Combine(archive.Root, "DiscWeave Backups")));
    }

    [Fact(DisplayName = "Active runtime leases prevent upgrades and release permits a retry")]
    public async Task Runtime_lease_blocks_upgrade_until_released()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        using (ArchiveMaintenanceLease.Acquire(archive.Data))
        {
            Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
            ArchiveUpgradeResult blocked = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
            Assert.Equal("blocked", blocked.Status);
            Assert.Null(blocked.BackupDirectory);
        }

        Assert.Equal("upgraded", (await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings)).Status);
    }

    [Fact(DisplayName = "Backup failures leave the archive untouched and a clean retry can succeed")]
    public async Task Backup_failure_leaves_schema_untouched_and_retry_succeeds()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        string unsafePath = Path.Combine(archive.Data, "artifacts", "unsafe-link");
        _ = File.CreateSymbolicLink(unsafePath, Path.Combine(archive.Settings, "watched-import-folders.json"));
        ArchiveUpgradeResult failed = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("blocked", failed.Status);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        Assert.Null(failed.BackupDirectory);
        File.Delete(unsafePath);
        ArchiveUpgradeResult retry = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("upgraded", retry.Status);
        Assert.NotNull(retry.BackupDirectory);
        Assert.DoesNotContain(".incomplete", retry.BackupDirectory, StringComparison.Ordinal);
    }

    [Fact(DisplayName = "Cancellation and overlapping upgrade requests never produce two upgrades")]
    public async Task Cancellation_and_overlap_do_not_duplicate_upgrades()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();
        _ = await Assert.ThrowsAnyAsync<OperationCanceledException>(() => ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings, cancellation.Token));
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        Task<ArchiveUpgradeResult> first = ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Task<ArchiveUpgradeResult> second = ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        ArchiveUpgradeResult[] results = await Task.WhenAll(first, second);
        _ = Assert.Single(results, result => result.Status == "upgraded");
        Assert.All(results, result => Assert.True(result.Status is "upgraded" or "blocked" or "current"));
        Assert.Equal("current", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
    }

    [Fact(DisplayName = "The operational upgrade and same-root settings are compatible with maintenance status")]
    public async Task Operational_upgrade_and_shared_settings_remain_compatible()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        string script = File.ReadAllText(Path.Combine(Architecture.RepositoryRoot.Find().FullName, "docs", "backup", "add-label-import-session-links.sql"));
        _ = await archive.Context.Database.ExecuteSqlRawAsync(script);
        Assert.Equal("current", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        Assert.Equal("current", (await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Data)).Status);
    }

    [Fact(DisplayName = "Foreign key violations prevent upgrade before creating a backup")]
    public async Task Invalid_foreign_keys_prevent_upgrade()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        await using var connection = new SqliteConnection($"Data Source={archive.Database};Foreign Keys=False;Pooling=False");
        await connection.OpenAsync();
        using SqliteCommand command = connection.CreateCommand();
        command.CommandText = "INSERT INTO labels (label_id,collection_id,name,name_key) VALUES ($label,$collection,'Broken','BROKEN')";
        _ = command.Parameters.AddWithValue("$label", Guid.CreateVersion7());
        _ = command.Parameters.AddWithValue("$collection", Guid.CreateVersion7());
        _ = await command.ExecuteNonQueryAsync();
        ArchiveUpgradeResult result = await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings);
        Assert.Equal("blocked", result.Status);
        Assert.Equal("schema.integrity_failed", result.Code);
        Assert.Null(result.BackupDirectory);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
    }

    private sealed class ArchiveFixture : IAsyncDisposable
    {
        private ArchiveFixture(string temporary, string data, string settings, DiscWeaveDbContext context, CollectionId collection)
        {
            Root = temporary;
            Data = data;
            Settings = settings;
            Context = context;
            Collection = collection;
        }

        public string Root { get; }
        public string Data { get; }
        public string Settings { get; }
        public string Database => Path.Combine(Data, "discweave.sqlite");
        public DiscWeaveDbContext Context { get; }
        public CollectionId Collection { get; }

        public static async Task<ArchiveFixture> CreateAsync(Func<string, string>? schemaTransform = null)
        {
            string temporary = Path.Combine(Path.GetTempPath(), "discweave-upgrade-test-" + Guid.CreateVersion7().ToString("N"));
            string data = Path.Combine(temporary, "data");
            string settings = Path.Combine(temporary, "settings");
            _ = Directory.CreateDirectory(Path.Combine(data, "artifacts"));
            _ = Directory.CreateDirectory(settings);
            await File.WriteAllTextAsync(Path.Combine(data, "artifacts", "cover.txt"), "cover-data");
            await File.WriteAllTextAsync(Path.Combine(settings, "watched-import-folders.json"), "settings-data");
            await File.WriteAllTextAsync(Path.Combine(settings, "Chromium-cache"), "excluded");
            DiscWeaveDbContext context = OpenContext(Path.Combine(data, "discweave.sqlite"));
            if (schemaTransform is null)
            {
                _ = await context.Database.EnsureCreatedAsync();
            }
            else
            {
                _ = await context.Database.ExecuteSqlRawAsync(schemaTransform(context.Database.GenerateCreateScript()));
            }
            var collection = MusicCollection.Create(CollectionId.New(), UserId.New(), "Upgrade test");
            _ = context.MusicCollections.Add(collection);
            _ = await context.SaveChangesAsync();
            _ = await context.Database.ExecuteSqlRawAsync("DROP TABLE label_import_session_links");
            return new ArchiveFixture(temporary, data, settings, context, collection.Id);
        }

        public static DiscWeaveDbContext OpenContext(string database)
        {
            DbContextOptions<DiscWeaveDbContext> options = new DbContextOptionsBuilder<DiscWeaveDbContext>().UseSqlite($"Data Source={database};Pooling=False").Options;
            return new DiscWeaveDbContext(options);
        }

        public async ValueTask DisposeAsync()
        {
            await Context.DisposeAsync();
            Directory.Delete(Root, recursive: true);
        }
    }
}
