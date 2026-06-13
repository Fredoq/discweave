using DiscWeave.Application.Catalog.Releases;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Infrastructure.Tests;

public sealed class LocalDesktopReleaseCoverStorageTests : IDisposable
{
    private const string DataDirectoryVariableName = "DISCWEAVE_DATA_DIR";
    private const string RuntimeModeVariableName = "DISCWEAVE_RUNTIME_MODE";
    private readonly string? _originalDataDirectory = Environment.GetEnvironmentVariable(DataDirectoryVariableName);
    private readonly string? _originalRuntimeMode = Environment.GetEnvironmentVariable(RuntimeModeVariableName);
    private readonly string _dataDirectory = Path.Combine(
        Path.GetTempPath(),
        "discweave-local-desktop-cover-storage-tests",
        Guid.CreateVersion7().ToString("N"));

    [Fact(DisplayName = "Local desktop release cover storage uses the application support artifact directory")]
    public async Task Local_desktop_release_cover_storage_uses_the_application_support_artifact_directory()
    {
        Environment.SetEnvironmentVariable(RuntimeModeVariableName, "LocalDesktop");
        Environment.SetEnvironmentVariable(DataDirectoryVariableName, _dataDirectory);
        IConfiguration configuration = new ConfigurationBuilder().Build();
        ServiceCollection services = [];
        _ = DependencyInjection.AddDiscWeaveInfrastructure(services, configuration);

        using ServiceProvider provider = services.BuildServiceProvider();
        IReleaseCoverStorage storage = provider.GetRequiredService<IReleaseCoverStorage>();
        ReleaseCoverStoredFile storedFile = await storage.SaveAsync(
            CollectionId.New(),
            ReleaseId.New(),
            ".jpg",
            new MemoryStream([0xFF, 0xD8, 0xFF, 0x00]),
            CancellationToken.None);
        string expectedPath = Path.Combine(
            _dataDirectory,
            "artifacts",
            "covers",
            Path.Combine(storedFile.StorageKey.Split('/')));

        Assert.True(File.Exists(expectedPath));
    }

    public void Dispose()
    {
        Environment.SetEnvironmentVariable(RuntimeModeVariableName, _originalRuntimeMode);
        Environment.SetEnvironmentVariable(DataDirectoryVariableName, _originalDataDirectory);
        if (Directory.Exists(_dataDirectory))
        {
            Directory.Delete(_dataDirectory, recursive: true);
        }
    }
}
