using System.Collections.Concurrent;

namespace DiscWeave.Api.Tests;

public sealed class SqliteFixture : IAsyncLifetime
{
    private readonly ConcurrentBag<string> _dataDirectories = [];

    public Task InitializeAsync()
    {
        return Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        foreach (string dataDirectory in _dataDirectories)
        {
            await TryDeleteDirectoryAsync(dataDirectory);
        }
    }

    public Task<string> CreateDatabaseAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        string dataDirectory = Path.Combine(Path.GetTempPath(), $"discweave-api-{Guid.CreateVersion7():N}");
        _ = Directory.CreateDirectory(dataDirectory);
        _dataDirectories.Add(dataDirectory);

        return Task.FromResult($"Data Source={Path.Combine(dataDirectory, "discweave.sqlite")}");
    }

    private static async Task TryDeleteDirectoryAsync(string dataDirectory)
    {
        const int maxAttempts = 4;
        for (int attempt = 1; attempt <= maxAttempts; attempt++)
        {
            if (!Directory.Exists(dataDirectory))
            {
                return;
            }

            try
            {
                Directory.Delete(dataDirectory, recursive: true);
                return;
            }
            catch (Exception exception) when (
                (exception is IOException or UnauthorizedAccessException) &&
                attempt < maxAttempts)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(50 * attempt));
            }
            catch (IOException)
            {
                return;
            }
            catch (UnauthorizedAccessException)
            {
                return;
            }
        }
    }
}
