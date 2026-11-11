using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace DiscWeave.Infrastructure.LocalDesktop;

internal static class ArchiveBackup
{
    private static readonly JsonSerializerOptions ManifestOptions = new() { WriteIndented = true };
    private static readonly string[] Exclusions = ["External audio files", "Browser profile and caches", "Cookies and sessions", "localStorage staged plans and UI preferences", "Application logs"];
    private static readonly string[] DataEntries = ["artifacts", "integrations.local.json"];
    private static readonly string[] SettingsEntries = ["watched-import-folders.json", "discover-credentials.enc", "local-file-trust.json", "scan-manifests", "local-edit-operation-logs"];

    public static async Task<string> CreateAsync(string dataDirectory, string settingsDirectory, string databasePath, CancellationToken cancellationToken)
    {
        string data = Path.TrimEndingDirectorySeparator(Path.GetFullPath(dataDirectory));
        string settings = Path.TrimEndingDirectorySeparator(Path.GetFullPath(settingsDirectory));
        string parent = Path.GetDirectoryName(data) ?? throw new IOException("Archive has no backup parent");
        string backupRoot = Path.Combine(parent, "DiscWeave Backups");
        if (backupRoot == data || backupRoot == settings || backupRoot.StartsWith(settings + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            throw new IOException("Backup destination overlaps archive settings");
        }

        CreatePrivateDirectory(backupRoot);
        string name = DateTimeOffset.UtcNow.ToString("yyyyMMddTHHmmssfffffffZ", System.Globalization.CultureInfo.InvariantCulture) + "-" + Guid.CreateVersion7().ToString("N");
        string pending = Path.Combine(backupRoot, name + ".incomplete");
        string complete = Path.Combine(backupRoot, name);
        CreatePrivateDirectory(pending);
        var hashes = new SortedDictionary<string, string>(StringComparer.Ordinal);
        string dataBackup = Path.Combine(pending, "data");
        CreatePrivateDirectory(dataBackup);
        string databaseBackup = Path.Combine(dataBackup, "discweave.sqlite");
        using (FileStream placeholder = new(databaseBackup, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            RestrictFile(databaseBackup);
        }

        await using (var source = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databasePath, Mode = SqliteOpenMode.ReadOnly, Pooling = false, DefaultTimeout = 5 }.ToString()))
        await using (var destination = new SqliteConnection(new SqliteConnectionStringBuilder { DataSource = databaseBackup, Mode = SqliteOpenMode.ReadWrite, Pooling = false }.ToString()))
        {
            await source.OpenAsync(cancellationToken);
            await destination.OpenAsync(cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            source.BackupDatabase(destination);
            using SqliteCommand command = destination.CreateCommand();
            command.CommandText = "PRAGMA journal_mode=DELETE";
            _ = await command.ExecuteNonQueryAsync(cancellationToken);
            if (!await ArchiveSchemaMaintenance.HasValidIntegrityAsync(destination, cancellationToken))
            {
                throw new IOException("Archive backup validation failed");
            }
        }

        hashes.Add("data/discweave.sqlite", await HashAsync(databaseBackup, cancellationToken));
        var included = new SortedDictionary<string, bool>(StringComparer.Ordinal);
        await CopyEntriesAsync(data, dataBackup, pending, DataEntries, hashes, included, cancellationToken);
        bool sharedSettings = data == settings;
        await CopyEntriesAsync(settings, sharedSettings ? dataBackup : Path.Combine(pending, "settings"), pending, SettingsEntries, hashes, included, cancellationToken);

        string manifest = JsonSerializer.Serialize(new
        {
            FormatVersion = 1,
            ArchiveSchemaMaintenance.UpgradeId,
            CreatedAt = DateTimeOffset.UtcNow,
            DataDirectory = data,
            SettingsDirectory = settings,
            SettingsIncludedInData = sharedSettings,
            Files = hashes,
            IncludedEntries = included,
            Excluded = Exclusions,
        }, ManifestOptions);
        string manifestPath = Path.Combine(pending, "manifest.json");
        await WritePrivateAsync(manifestPath, manifest, cancellationToken);
        foreach ((string relative, string hash) in hashes)
        {
            if (await HashAsync(Path.Combine(pending, relative), cancellationToken) != hash)
            {
                throw new IOException("Archive backup changed before completion");
            }
        }

        await ValidateSourcesAsync(data, settings, sharedSettings, hashes, included, cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();
        Directory.Move(pending, complete);
        return complete;
    }

    private static async Task ValidateSourcesAsync(string data, string settings, bool sharedSettings, SortedDictionary<string, string> backupHashes, SortedDictionary<string, bool> included, CancellationToken cancellationToken)
    {
        var current = new SortedDictionary<string, string>(StringComparer.Ordinal);
        await HashEntriesAsync(data, "data", DataEntries, current, included, cancellationToken);
        await HashEntriesAsync(settings, sharedSettings ? "data" : "settings", SettingsEntries, current, included, cancellationToken);
        if (current.Count != backupHashes.Count - 1 || current.Any(pair => !backupHashes.TryGetValue(pair.Key, out string? hash) || hash != pair.Value))
        {
            throw new IOException("Archive files changed while the backup was prepared");
        }
    }

    private static async Task HashEntriesAsync(string root, string prefix, string[] entries, SortedDictionary<string, string> hashes, SortedDictionary<string, bool> included, CancellationToken cancellationToken)
    {
        foreach (string entry in entries)
        {
            string path = Path.Combine(root, entry);
            string relative = prefix + "/" + entry;
            if (Path.Exists(path) != included[relative])
            {
                throw new IOException("Archive entries changed during backup");
            }

            if (included[relative])
            {
                await HashEntryAsync(path, relative, hashes, cancellationToken);
            }
        }
    }

    private static async Task HashEntryAsync(string path, string relative, SortedDictionary<string, string> hashes, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        FileAttributes attributes = File.GetAttributes(path);
        if ((attributes & FileAttributes.ReparsePoint) != 0)
        {
            throw new IOException("Archive backup cannot follow symbolic links");
        }

        if ((attributes & FileAttributes.Directory) != 0)
        {
            foreach (string child in Directory.EnumerateFileSystemEntries(path))
            {
                await HashEntryAsync(child, relative + "/" + Path.GetFileName(child), hashes, cancellationToken);
            }
        }
        else
        {
            hashes.Add(relative, await HashAsync(path, cancellationToken));
        }
    }

    private static async Task CopyEntriesAsync(string source, string target, string backup, string[] entries, SortedDictionary<string, string> hashes, SortedDictionary<string, bool> included, CancellationToken cancellationToken)
    {
        CreatePrivateDirectory(target);
        foreach (string name in entries)
        {
            string entry = Path.Combine(source, name);
            bool exists = Path.Exists(entry);
            included.Add(Path.GetRelativePath(backup, Path.Combine(target, name)).Replace(Path.DirectorySeparatorChar, '/'), exists);
            if (!exists)
            {
                continue;
            }

            if ((File.GetAttributes(entry) & FileAttributes.ReparsePoint) != 0)
            {
                throw new IOException("Archive backup cannot follow symbolic links");
            }

            if (Directory.Exists(entry))
            {
                await CopyDirectoryAsync(entry, Path.Combine(target, name), backup, hashes, cancellationToken);
            }
            else
            {
                await CopyFileAsync(entry, Path.Combine(target, name), backup, hashes, cancellationToken);
            }
        }
    }

    private static async Task CopyDirectoryAsync(string source, string target, string backup, SortedDictionary<string, string> hashes, CancellationToken cancellationToken)
    {
        CreatePrivateDirectory(target);
        foreach (string entry in Directory.EnumerateFileSystemEntries(source).Order(StringComparer.Ordinal))
        {
            cancellationToken.ThrowIfCancellationRequested();
            FileAttributes attributes = File.GetAttributes(entry);
            if ((attributes & FileAttributes.ReparsePoint) != 0)
            {
                throw new IOException("Archive backup cannot follow symbolic links");
            }

            string name = Path.GetFileName(entry);
            string destination = Path.Combine(target, name);
            if ((attributes & FileAttributes.Directory) != 0)
            {
                await CopyDirectoryAsync(entry, destination, backup, hashes, cancellationToken);
            }
            else
            {
                await CopyFileAsync(entry, destination, backup, hashes, cancellationToken);
            }
        }
    }

    private static async Task CopyFileAsync(string source, string destination, string backup, SortedDictionary<string, string> hashes, CancellationToken cancellationToken)
    {
        await using (FileStream input = new(source, FileMode.Open, FileAccess.Read, FileShare.Read))
        await using (FileStream output = new(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            RestrictFile(destination);
            await input.CopyToAsync(output, cancellationToken);
            await output.FlushAsync(cancellationToken);
            output.Flush(flushToDisk: true);
        }

        string hash = await HashAsync(destination, cancellationToken);
        if (hash != await HashAsync(source, cancellationToken))
        {
            throw new IOException("Archive file changed during backup");
        }

        hashes.Add(Path.GetRelativePath(backup, destination).Replace(Path.DirectorySeparatorChar, '/'), hash);
    }

    private static void CreatePrivateDirectory(string path)
    {
        if (File.Exists(path) || (Directory.Exists(path) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0))
        {
            throw new IOException("Backup directory is not safe");
        }

        if (OperatingSystem.IsWindows())
        {
            _ = Directory.CreateDirectory(path);
        }
        else
        {
            _ = Directory.CreateDirectory(path, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        }
    }

    private static void RestrictFile(string path)
    {
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
    }

    private static async Task WritePrivateAsync(string path, string content, CancellationToken cancellationToken)
    {
        await using FileStream stream = new(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        RestrictFile(path);
        byte[] bytes = System.Text.Encoding.UTF8.GetBytes(content);
        await stream.WriteAsync(bytes, cancellationToken);
        await stream.FlushAsync(cancellationToken);
        stream.Flush(flushToDisk: true);
    }

    private static async Task<string> HashAsync(string path, CancellationToken cancellationToken)
    {
        await using FileStream stream = new(path, FileMode.Open, FileAccess.Read, FileShare.Read);
        return Convert.ToHexString(await SHA256.HashDataAsync(stream, cancellationToken));
    }
}
