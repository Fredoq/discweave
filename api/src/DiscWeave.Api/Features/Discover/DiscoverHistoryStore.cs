using System.Text.Json;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Discover;

public sealed class DiscoverHistoryStore : IDisposable
{
    private readonly string _directory;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly TimeProvider _time;

    public DiscoverHistoryStore(IConfiguration configuration, TimeProvider time)
    {
        _time = time;
        string basePath = Environment.GetEnvironmentVariable("DISCWEAVE_DATA_DIR") ??
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "DiscWeave");
        _directory = configuration["DiscWeave:DiscoverHistoryDirectory"] ?? Path.Combine(basePath, "discover-history");
    }

    public async Task<DiscoverHistoryEntry[]> ReadAsync(CollectionId collectionId, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            return await LoadAsync(collectionId, cancellationToken);
        }
        finally
        {
            _ = _gate.Release();
        }
    }

    public async Task<bool> RecordAsync(CollectionId collectionId, IReadOnlyList<DiscoverHistoryEntry> entries, bool requireShown, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            DiscoverHistoryEntry[] existing = await LoadAsync(collectionId, cancellationToken);
            if (requireShown && entries.Any(entry => !existing.Any(previous => previous.ExternalId == entry.ExternalId)))
            {
                return false;
            }

            DiscoverHistoryEntry[] protectedEntries = [.. entries.Select(entry => entry.Kind == "shown"
                ? existing.FirstOrDefault(previous => previous.ExternalId == entry.ExternalId && previous.Kind != "shown") ?? entry
                : entry)];
            DiscoverHistoryEntry[] merged = [.. protectedEntries.Concat(existing).DistinctBy(entry => entry.ExternalId).Take(500)];
            _ = Directory.CreateDirectory(_directory);
            string destination = FilePath(collectionId);
            string temporary = destination + ".tmp";
            await File.WriteAllTextAsync(temporary, JsonSerializer.Serialize(merged), cancellationToken);
            if (!OperatingSystem.IsWindows())
            {
                File.SetUnixFileMode(temporary, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            }

            File.Move(temporary, destination, true);
            return true;
        }
        finally
        {
            _ = _gate.Release();
        }
    }

    public DiscoverHistoryEntry Shown(string externalId, string[] keys, string artist = "", string title = "") => new(externalId, keys, "shown", _time.GetUtcNow(), artist.Length > 120 ? artist[..120] : artist, title.Length > 120 ? title[..120] : title);

    public void Dispose() => _gate.Dispose();

    private string FilePath(CollectionId collectionId) => Path.Combine(_directory, collectionId.Value.ToString("N") + ".json");

    private async Task<DiscoverHistoryEntry[]> LoadAsync(CollectionId collectionId, CancellationToken cancellationToken)
    {
        string file = FilePath(collectionId);
        if (!File.Exists(file))
        {
            return [];
        }

        await using FileStream stream = File.OpenRead(file);
        if (stream.Length > 512 * 1024)
        {
            throw new IOException("Discover history exceeds its storage limit");
        }

        DiscoverHistoryEntry[] entries = await JsonSerializer.DeserializeAsync<DiscoverHistoryEntry[]>(stream, cancellationToken: cancellationToken) ?? [];
        return [.. entries.Where(entry => entry.Kind != "shown" || entry.At > _time.GetUtcNow().AddDays(-30)).Take(500)];
    }
}
