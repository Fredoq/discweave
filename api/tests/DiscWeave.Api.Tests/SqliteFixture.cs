using System.Collections.Concurrent;

namespace DiscWeave.Api.Tests;

public sealed class SqliteFixture : IAsyncLifetime
{
    private readonly ConcurrentBag<string> _dataDirectories = [];

    public Task InitializeAsync()
    {
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        foreach (string dataDirectory in _dataDirectories)
        {
            if (Directory.Exists(dataDirectory))
            {
                Directory.Delete(dataDirectory, recursive: true);
            }
        }

        return Task.CompletedTask;
    }

    public Task<string> CreateDatabaseAsync(CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();

        string dataDirectory = Path.Combine(Path.GetTempPath(), $"discweave-api-{Guid.CreateVersion7():N}");
        _ = Directory.CreateDirectory(dataDirectory);
        _dataDirectories.Add(dataDirectory);

        return Task.FromResult($"Data Source={Path.Combine(dataDirectory, "discweave.sqlite")}");
    }
}
