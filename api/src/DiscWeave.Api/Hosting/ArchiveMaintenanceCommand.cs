using System.Text.Json;
using DiscWeave.Infrastructure.LocalDesktop;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Hosting;

public static class ArchiveMaintenanceCommand
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public static bool IsMaintenanceCommand(string[] arguments)
    {
        return arguments.Length == 1 && arguments[0] is "--archive-status" or "--upgrade-archive";
    }

    public static Task<int> RunAsync(string command, CancellationToken cancellationToken = default)
    {
        WebApplicationBuilder builder = WebApplication.CreateBuilder([]);
        return RunAsync(command, builder.Configuration, cancellationToken);
    }

    public static async Task<int> RunAsync(string command, IConfiguration configuration, CancellationToken cancellationToken = default)
    {
        string? dataDirectory = Environment.GetEnvironmentVariable("DISCWEAVE_DATA_DIR");
        string? settingsDirectory = Environment.GetEnvironmentVariable("DISCWEAVE_DESKTOP_SETTINGS_DIR");
        try
        {
            if (HasCustomArchivePaths(configuration))
            {
                return WriteFailure(command, "archive.configuration_unsupported");
            }

            if (string.IsNullOrWhiteSpace(dataDirectory))
            {
                return WriteFailure(command, "archive.data_directory_required");
            }

            if (command == "--archive-status")
            {
                ArchiveSchemaStatus status = await ArchiveSchemaMaintenance.InspectAsync(dataDirectory, cancellationToken);
                Console.WriteLine(JsonSerializer.Serialize(status, JsonOptions));
                return status.Status == "unsupported" ? 1 : 0;
            }

            if (string.IsNullOrWhiteSpace(settingsDirectory))
            {
                return WriteFailure(command, "archive.settings_directory_required");
            }

            ArchiveUpgradeResult result = await ArchiveSchemaMaintenance.UpgradeAsync(dataDirectory, settingsDirectory, cancellationToken);
            Console.WriteLine(JsonSerializer.Serialize(result, JsonOptions));
            return result.Status is "upgraded" or "current" ? 0 : 1;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidOperationException or OperationCanceledException)
        {
            return WriteFailure(command, exception is OperationCanceledException ? "archive.cancelled" : "archive.maintenance_failed");
        }
    }

    public static IDisposable? AcquireRuntimeLease(IServiceProvider services)
    {
        if (!IsLocalDesktopMode())
        {
            return null;
        }

        using IServiceScope scope = services.CreateScope();
        DiscWeaveDbContext context = scope.ServiceProvider.GetRequiredService<DiscWeaveDbContext>();
        string databasePath = Path.GetFullPath(context.Database.GetDbConnection().DataSource);
        string directory = Path.GetDirectoryName(databasePath) ?? throw new InvalidOperationException("Archive directory is unavailable");
        return ArchiveMaintenanceLease.Acquire(directory);
    }

    internal static bool HasCustomArchivePaths(IConfiguration configuration)
    {
        // Local desktop infrastructure overrides ReleaseCovers:StorageRoot with
        // the canonical artifacts directory when no connection override exists.
        return !string.IsNullOrWhiteSpace(configuration.GetConnectionString("DiscWeave")) ||
            !string.IsNullOrWhiteSpace(configuration["DiscWeave:IntegrationSettingsPath"]);
    }

    internal static bool IsLocalDesktopMode()
    {
        return string.Equals(Environment.GetEnvironmentVariable("DISCWEAVE_RUNTIME_MODE"), "LocalDesktop", StringComparison.OrdinalIgnoreCase);
    }

    private static int WriteFailure(string command, string code)
    {
        object result = command == "--archive-status"
            ? new ArchiveSchemaStatus("unsupported", "label-import-links-v1", false, code)
            : new ArchiveUpgradeResult("blocked", code, null);
        Console.WriteLine(JsonSerializer.Serialize(result, JsonOptions));
        return 1;
    }
}
