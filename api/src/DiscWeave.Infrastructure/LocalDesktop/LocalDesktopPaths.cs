namespace DiscWeave.Infrastructure.LocalDesktop;

internal sealed class LocalDesktopPaths
{
    private const string DataDirEnvironmentVariable = "DISCWEAVE_DATA_DIR";

    public LocalDesktopPaths(string dataDirectory)
    {
        DataDirectory = dataDirectory;
        DatabasePath = Path.Combine(dataDirectory, "discweave.sqlite");
        ArtifactDirectory = Path.Combine(dataDirectory, "artifacts");
        CoverDirectory = Path.Combine(ArtifactDirectory, "covers");
        ImportArtifactDirectory = Path.Combine(ArtifactDirectory, "imports");
        IntegrationSettingsPath = Path.Combine(dataDirectory, "integrations.local.json");
        LogDirectory = Path.Combine(dataDirectory, "logs");
    }

    public string DataDirectory { get; }

    public string DatabasePath { get; }

    public string ArtifactDirectory { get; }

    public string CoverDirectory { get; }

    public string ImportArtifactDirectory { get; }

    public string IntegrationSettingsPath { get; }

    public string LogDirectory { get; }

    public static LocalDesktopPaths Resolve()
    {
        string? configured = Environment.GetEnvironmentVariable(DataDirEnvironmentVariable);
        string dataDirectory = string.IsNullOrWhiteSpace(configured)
            ? DefaultApplicationSupportDirectory()
            : configured;

        return new LocalDesktopPaths(Path.GetFullPath(dataDirectory));
    }

    public void EnsureCreated()
    {
        _ = Directory.CreateDirectory(DataDirectory);
        _ = Directory.CreateDirectory(ArtifactDirectory);
        _ = Directory.CreateDirectory(CoverDirectory);
        _ = Directory.CreateDirectory(ImportArtifactDirectory);
        _ = Directory.CreateDirectory(LogDirectory);
    }

    private static string DefaultApplicationSupportDirectory()
    {
        string home = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (!string.IsNullOrWhiteSpace(home) && OperatingSystem.IsMacOS())
        {
            return Path.Combine(home, "Library", "Application Support", "DiscWeave");
        }

        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(string.IsNullOrWhiteSpace(appData) ? AppContext.BaseDirectory : appData, "DiscWeave");
    }
}
