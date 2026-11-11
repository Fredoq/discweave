using System.Diagnostics;
using System.Text.Json;
using DiscWeave.Infrastructure.LocalDesktop;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class ArchiveSchemaMaintenanceTests
{
    [Fact(DisplayName = "Killing the offline upgrader after schema writes preserves its backup and rolls back uncommitted schema")]
    public async Task Killing_upgrader_before_commit_retains_backup_and_allows_retry()
    {
        await using ArchiveFixture archive = await ArchiveFixture.CreateAsync();
        _ = await archive.Context.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=DELETE");
        await using var reader = new SqliteConnection($"Data Source={archive.Database};Pooling=False");
        await reader.OpenAsync();
        using SqliteCommand read = reader.CreateCommand();
        read.CommandText = "BEGIN";
        _ = await read.ExecuteNonQueryAsync();
        read.CommandText = "SELECT COUNT(*) FROM labels";
        _ = await read.ExecuteScalarAsync();
        using Process child = StartArchiveCommand(archive, "--upgrade-archive");
        Task<string> output = child.StandardOutput.ReadToEndAsync();
        Task<string> errors = child.StandardError.ReadToEndAsync();
        string backupRoot = Path.Combine(archive.Root, "DiscWeave Backups");
        string? completed = null;
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            while (completed is null || !File.Exists(archive.Database + "-journal"))
            {
                Assert.False(child.HasExited, "The upgrade should wait for the reader before committing");
                if (Directory.Exists(backupRoot))
                {
                    completed = Directory.GetDirectories(backupRoot).FirstOrDefault(path => !path.EndsWith(".incomplete", StringComparison.Ordinal) && File.Exists(Path.Combine(path, "manifest.json")));
                }

                await Task.Delay(10, timeout.Token);
            }

            child.Kill(entireProcessTree: true);
            await child.WaitForExitAsync(timeout.Token);
        }
        finally
        {
            if (!child.HasExited)
            {
                child.Kill(entireProcessTree: true);
                await child.WaitForExitAsync();
            }

            read.CommandText = "ROLLBACK";
            _ = await read.ExecuteNonQueryAsync();
        }

        _ = await output;
        _ = await errors;
        Assert.NotNull(completed);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(archive.Data)).Status);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectDatabaseAsync(Path.Combine(completed, "data", "discweave.sqlite"))).Status);
        Assert.Equal("upgraded", (await ArchiveSchemaMaintenance.UpgradeAsync(archive.Data, archive.Settings)).Status);
    }

    [Fact(DisplayName = "Custom database configuration blocks CLI upgrades without modifying either archive")]
    public async Task Custom_database_configuration_blocks_cli_without_touching_archives()
    {
        await using ArchiveFixture canonical = await ArchiveFixture.CreateAsync();
        await using ArchiveFixture configured = await ArchiveFixture.CreateAsync();
        foreach (string command in new[] { "--archive-status", "--upgrade-archive" })
        {
            using Process child = StartArchiveCommand(canonical, command, configured.Database);
            Task<string> output = child.StandardOutput.ReadToEndAsync();
            Task<string> errors = child.StandardError.ReadToEndAsync();
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30));
            await child.WaitForExitAsync(timeout.Token);
            using var result = JsonDocument.Parse(await output);
            _ = await errors;
            Assert.Equal(1, child.ExitCode);
            Assert.Equal("archive.configuration_unsupported", result.RootElement.GetProperty("code").GetString());
        }

        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(canonical.Data)).Status);
        Assert.Equal("upgradeRequired", (await ArchiveSchemaMaintenance.InspectAsync(configured.Data)).Status);
        Assert.False(Directory.Exists(Path.Combine(canonical.Root, "DiscWeave Backups")));
        Assert.False(Directory.Exists(Path.Combine(configured.Root, "DiscWeave Backups")));
    }

    private static Process StartArchiveCommand(ArchiveFixture archive, string command, string? configuredDatabase = null)
    {
        string host = Environment.GetEnvironmentVariable("DOTNET_HOST_PATH") ?? Environment.ProcessPath ?? throw new InvalidOperationException("The .NET host is unavailable");
        var start = new ProcessStartInfo(host)
        {
            WorkingDirectory = archive.Root,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        start.ArgumentList.Add(typeof(Program).Assembly.Location);
        start.ArgumentList.Add(command);
        start.Environment["DISCWEAVE_DATA_DIR"] = archive.Data;
        start.Environment["DISCWEAVE_DESKTOP_SETTINGS_DIR"] = archive.Settings;
        start.Environment["DISCWEAVE_RUNTIME_MODE"] = "LocalDesktop";
        start.Environment["DOTNET_ENVIRONMENT"] = "Production";
        start.Environment["ASPNETCORE_ENVIRONMENT"] = "Production";
        start.Environment["ConnectionStrings__DiscWeave"] = configuredDatabase is null ? string.Empty : $"Data Source={configuredDatabase}";
        start.Environment["DiscWeave__IntegrationSettingsPath"] = string.Empty;
        return Process.Start(start) ?? throw new InvalidOperationException("The archive command did not start");
    }
}
