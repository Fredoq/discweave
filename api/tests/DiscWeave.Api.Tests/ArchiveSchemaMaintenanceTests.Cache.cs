using System.Reflection;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.LocalDesktop;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Api.Tests;

public sealed partial class ArchiveSchemaMaintenanceTests
{
    [Fact(DisplayName = "Schema cache shares signatures across archives and bounds unknown-schema retention")]
    public async Task Cache_shares_signatures_and_bounds_unknown_schema_retention()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        ArchiveSchemaStatus expected = await ArchiveSchemaMaintenance.InspectAsync(archive.Data);
        for (int index = 0; index < 40; index++)
        {
            string copy = Path.Combine(archive.Root, $"copy-{index}.sqlite");
            File.Copy(archive.Database, copy);
            Assert.Equal(expected, await ArchiveSchemaMaintenance.InspectDatabaseAsync(copy));
            await using var connection = new SqliteConnection($"Data Source={copy};Pooling=False");
            await connection.OpenAsync();
            using SqliteCommand command = connection.CreateCommand();
            command.CommandText = $"CREATE TABLE unknown_{index} (id INTEGER PRIMARY KEY)";
            _ = await command.ExecuteNonQueryAsync();
            Assert.Equal("unsupported", (await ArchiveSchemaMaintenance.InspectDatabaseAsync(copy)).Status);
            FieldInfo? field = typeof(ArchiveSchemaMaintenance).GetField("StatusCache", BindingFlags.NonPublic | BindingFlags.Static);
            Assert.NotNull(field);
            IReadOnlyDictionary<string, ArchiveSchemaStatus> cache = Assert.IsAssignableFrom<IReadOnlyDictionary<string, ArchiveSchemaStatus>>(field.GetValue(null));
            Assert.InRange(cache.Count, 1, 16);
            Assert.All(cache.Keys, signature => Assert.Equal(64, signature.Length));
        }
    }

    [Fact(DisplayName = "Concurrent schema transactions invalidate status only after commit")]
    public async Task Concurrent_schema_transactions_invalidate_status_only_after_commit()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        string unchanged = Path.Combine(archive.Root, "unchanged.sqlite");
        File.Copy(archive.Database, unchanged);
        await using var writer = new SqliteConnection($"Data Source={archive.Database};Pooling=False");
        await writer.OpenAsync();
        using (SqliteTransaction transaction = writer.BeginTransaction())
        {
            using SqliteCommand command = writer.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "CREATE TABLE concurrent_schema_change (id INTEGER PRIMARY KEY)";
            _ = await command.ExecuteNonQueryAsync();
            Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
            await transaction.CommitAsync();
        }

        Assert.Equal("unsupported", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectDatabaseAsync(unchanged)).Status);
        using (SqliteTransaction transaction = writer.BeginTransaction())
        {
            using SqliteCommand command = writer.CreateCommand();
            command.Transaction = transaction;
            command.CommandText = "DROP TABLE concurrent_schema_change";
            _ = await command.ExecuteNonQueryAsync();
            Assert.Equal("unsupported", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
            await transaction.CommitAsync();
        }

        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
    }

    [Fact(DisplayName = "Catalog row changes do not become schema-cache keys")]
    public async Task Catalog_rows_are_not_part_of_schema_cache_keys()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        ArchiveSchemaStatus before = await ArchiveSchemaMaintenance.InspectAsync(archive.Data);
        _ = archive.Context.Labels.Add(Label.Create(archive.Collection, LabelId.New(), "Private catalog metadata"));
        _ = await archive.Context.SaveChangesAsync();
        ArchiveSchemaStatus after = await ArchiveSchemaMaintenance.InspectAsync(archive.Data);
        Assert.Same(before, after);
    }
}
