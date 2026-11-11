using System.Text.Json;
using System.Globalization;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Labels;

public sealed class LabelDiscogsPreferencesStore : IDisposable
{
    private readonly string _directory;
    private readonly SemaphoreSlim _gate = new(1, 1);

    public LabelDiscogsPreferencesStore(IConfiguration configuration)
    {
        string basePath = Environment.GetEnvironmentVariable("DISCWEAVE_DATA_DIR") ??
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DiscWeave");
        _directory = configuration["DiscWeave:LabelDiscogsPreferencesDirectory"] ?? Path.Combine(basePath, "label-discogs-preferences");
    }

    public async Task<LabelDiscogsPreferences> ReadAsync(CollectionId collectionId, LabelId labelId, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            string path = FilePath(collectionId, labelId);
            if (!File.Exists(path))
            {
                return LabelDiscogsPreferences.Empty;
            }

            await using FileStream stream = File.OpenRead(path);
            if (stream.Length > 32 * 1024)
            {
                throw new IOException("Label preferences exceed their storage limit");
            }

            LabelDiscogsPreferences? preferences = await JsonSerializer.DeserializeAsync<LabelDiscogsPreferences>(stream, cancellationToken: cancellationToken);
            return preferences is null || !IsValid(preferences)
                ? throw new JsonException("Label preferences are invalid")
                : preferences;
        }
        finally
        {
            _ = _gate.Release();
        }
    }

    public async Task SaveAsync(CollectionId collectionId, LabelId labelId, LabelDiscogsPreferences preferences, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(preferences);
        if (!IsValid(preferences))
        {
            throw new ArgumentException("Label preferences are invalid", nameof(preferences));
        }

        await _gate.WaitAsync(cancellationToken);
        string path = FilePath(collectionId, labelId);
        string temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            _ = Directory.CreateDirectory(_directory);
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(preferences), cancellationToken);
            if (!OperatingSystem.IsWindows())
            {
                File.SetUnixFileMode(temporary, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            }

            File.Move(temporary, path, true);
        }
        finally
        {
            _ = _gate.Release();
            if (File.Exists(temporary))
            {
                File.Delete(temporary);
            }
        }
    }

    private static bool IsValid(LabelDiscogsPreferences preferences)
    {
        return preferences.Prefixes is { Length: <= 50 } && preferences.Prefixes.All(prefix =>
            !string.IsNullOrWhiteSpace(prefix) && prefix.Length <= 64 && !prefix.Any(char.IsControl)) &&
            (preferences.DiscogsLabelId is null ? preferences.DiscogsLabelName is null && preferences.Prefixes.Length == 0 :
                preferences.DiscogsLabelName is { Length: > 0 and <= 500 } &&
                long.TryParse(preferences.DiscogsLabelId, NumberStyles.None, CultureInfo.InvariantCulture, out long id) && id > 0 &&
                preferences.DiscogsLabelId == id.ToString(CultureInfo.InvariantCulture));
    }

    private string FilePath(CollectionId collectionId, LabelId labelId)
    {
        return Path.Combine(_directory, $"{collectionId.Value:N}-{labelId.Value:N}.json");
    }

    public void Dispose()
    {
        _gate.Dispose();
    }
}
