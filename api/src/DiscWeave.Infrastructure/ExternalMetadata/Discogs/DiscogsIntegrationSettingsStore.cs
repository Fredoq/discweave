using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed class DiscogsIntegrationSettingsStore : IDiscogsIntegrationSettingsStore, IDisposable
{
    private static readonly Action<ILogger, string, Exception?> PermissionWarning =
        LoggerMessage.Define<string>(
            LogLevel.Warning,
            new EventId(1, nameof(TrySetOwnerOnlyPermissions)),
            "Failed to restrict Discogs integration settings file permissions for {SettingsPath}");

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly ILogger<DiscogsIntegrationSettingsStore> _logger;
    private readonly string _path;

    public DiscogsIntegrationSettingsStore(
        IConfiguration configuration,
        ILogger<DiscogsIntegrationSettingsStore> logger)
    {
        ArgumentNullException.ThrowIfNull(configuration);
        ArgumentNullException.ThrowIfNull(logger);

        _logger = logger;
        string? configuredPath = configuration["DiscWeave:IntegrationSettingsPath"];
        _path = string.IsNullOrWhiteSpace(configuredPath)
            ? LocalDesktop.LocalDesktopPaths.Resolve().IntegrationSettingsPath
            : Path.GetFullPath(configuredPath);
    }

    public async Task<string?> GetAccessTokenAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            DiscogsLocalIntegrationSettings settings = await ReadAsync(cancellationToken);
            string? token = settings.Discogs?.AccessToken?.Trim();

            return string.IsNullOrWhiteSpace(token) ? null : token;
        }
        finally
        {
            _ = _gate.Release();
        }
    }

    public async Task<bool> IsConfiguredAsync(CancellationToken cancellationToken)
    {
        return !string.IsNullOrWhiteSpace(await GetAccessTokenAsync(cancellationToken));
    }

    public async Task SaveAccessTokenAsync(string accessToken, CancellationToken cancellationToken)
    {
        string normalized = NormalizeAccessToken(accessToken);

        await _gate.WaitAsync(cancellationToken);
        try
        {
            DiscogsLocalIntegrationSettings settings = await ReadAsync(cancellationToken);
            settings.Discogs ??= new DiscogsLocalSettings();
            settings.Discogs.AccessToken = normalized;
            await WriteAsync(settings, cancellationToken);
        }
        finally
        {
            _ = _gate.Release();
        }
    }

    public async Task ClearAccessTokenAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            DiscogsLocalIntegrationSettings settings = await ReadAsync(cancellationToken);
            if (settings.Discogs is null)
            {
                return;
            }

            settings.Discogs.AccessToken = null;
            await WriteAsync(settings, cancellationToken);
        }
        finally
        {
            _ = _gate.Release();
        }
    }

    public static bool IsValidAccessToken(string? accessToken)
    {
        if (accessToken is null)
        {
            return false;
        }

        string trimmed = accessToken.Trim();
        return trimmed.Length is > 0 and <= 512 &&
            !trimmed.Any(char.IsControl);
    }

    private static string NormalizeAccessToken(string accessToken)
    {
        return IsValidAccessToken(accessToken)
            ? accessToken.Trim()
            : throw new ArgumentException("Discogs access token is invalid", nameof(accessToken));
    }

    public void Dispose()
    {
        _gate.Dispose();
    }

    private async Task<DiscogsLocalIntegrationSettings> ReadAsync(CancellationToken cancellationToken)
    {
        if (!File.Exists(_path))
        {
            return new DiscogsLocalIntegrationSettings();
        }

        await using FileStream stream = File.OpenRead(_path);
        DiscogsLocalIntegrationSettings? settings =
            await JsonSerializer.DeserializeAsync<DiscogsLocalIntegrationSettings>(stream, JsonOptions, cancellationToken);

        return settings ?? new DiscogsLocalIntegrationSettings();
    }

    private async Task WriteAsync(DiscogsLocalIntegrationSettings settings, CancellationToken cancellationToken)
    {
        string? directory = Path.GetDirectoryName(_path);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            _ = Directory.CreateDirectory(directory);
        }

        string temporaryPath = $"{_path}.{Guid.CreateVersion7():N}.tmp";
        try
        {
            await using (FileStream stream = File.Create(temporaryPath))
            {
                await JsonSerializer.SerializeAsync(stream, settings, JsonOptions, cancellationToken);
            }

            File.Move(temporaryPath, _path, overwrite: true);
            TrySetOwnerOnlyPermissions(_path);
        }
        catch
        {
            TryDeleteTemporaryFile(temporaryPath);
            throw;
        }
    }

    private void TrySetOwnerOnlyPermissions(string path)
    {
        if (!OperatingSystem.IsMacOS() && !OperatingSystem.IsLinux())
        {
            return;
        }

        try
        {
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
        catch (IOException exception)
        {
            LogPermissionWarning(exception, path);
        }
        catch (UnauthorizedAccessException exception)
        {
            LogPermissionWarning(exception, path);
        }
        catch (PlatformNotSupportedException exception)
        {
            LogPermissionWarning(exception, path);
        }
    }

    private void LogPermissionWarning(Exception exception, string path)
    {
        PermissionWarning(_logger, path, exception);
    }

    private static void TryDeleteTemporaryFile(string temporaryPath)
    {
        try
        {
            File.Delete(temporaryPath);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private sealed class DiscogsLocalIntegrationSettings
    {
        public DiscogsLocalSettings? Discogs { get; set; }
    }

    private sealed class DiscogsLocalSettings
    {
        public string? AccessToken { get; set; }
    }
}
