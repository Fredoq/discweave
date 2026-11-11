namespace DiscWeave.Infrastructure.LocalDesktop;

public static class ArchiveMaintenanceLease
{
    public static IDisposable Acquire(string dataDirectory)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(dataDirectory);
        if (!Directory.Exists(dataDirectory) || (File.GetAttributes(dataDirectory) & FileAttributes.ReparsePoint) != 0)
        {
            throw new IOException("Archive directory is unavailable");
        }

        string path = Path.Combine(dataDirectory, ".maintenance.lock");
        if (File.Exists(path) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0)
        {
            throw new IOException("Archive lease path is invalid");
        }

        var stream = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        try
        {
            if (!OperatingSystem.IsWindows())
            {
                File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
            }

            return stream;
        }
        catch
        {
            stream.Dispose();
            throw;
        }
    }
}
