using DiscWeave.Api.Http;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportsEndpointRouteBuilderExtensions
{
    private const string MacOsInstallerContentType = "application/x-apple-diskimage";
    private const string MacOsInstallerDefaultPattern = "DiscWeave*.dmg";

    private static IResult DownloadMacOsDesktopAsync(IWebHostEnvironment environment, IConfiguration configuration)
    {
        string? path = FindMacOsInstaller(environment, configuration);
        return path is not null
            ? Results.File(path, MacOsInstallerContentType, Path.GetFileName(path))
            : EndpointErrors.NotFound("desktop.download_not_found", "DiscWeave macOS desktop installer is not available in this build");
    }

    private static string? FindMacOsInstaller(IWebHostEnvironment environment, IConfiguration configuration)
    {
        string? configuredPath = ResolveConfiguredPath(configuration["DesktopDownloads:MacOsInstallerPath"], environment.ContentRootPath);
        if (configuredPath is not null && File.Exists(configuredPath))
        {
            return configuredPath;
        }

        string pattern = configuration["DesktopDownloads:MacOsInstallerPattern"] ?? MacOsInstallerDefaultPattern;
        foreach (string directory in CandidateMacOsInstallerDirectories(environment, configuration))
        {
            if (!Directory.Exists(directory))
            {
                continue;
            }

            FileInfo? installer = Directory.EnumerateFiles(directory, pattern, SearchOption.TopDirectoryOnly)
                .Select(path => new FileInfo(path))
                .OrderByDescending(file => file.LastWriteTimeUtc)
                .ThenByDescending(file => file.Name, StringComparer.OrdinalIgnoreCase)
                .FirstOrDefault();
            if (installer is not null)
            {
                return installer.FullName;
            }
        }

        return null;
    }

    private static IEnumerable<string> CandidateMacOsInstallerDirectories(IWebHostEnvironment environment, IConfiguration configuration)
    {
        string? configuredDirectory = ResolveConfiguredPath(configuration["DesktopDownloads:MacOsInstallerDirectory"], environment.ContentRootPath);
        if (configuredDirectory is not null)
        {
            yield return configuredDirectory;
        }

        yield return Path.Combine(environment.ContentRootPath, "desktop");
    }

    private static string? ResolveConfiguredPath(string? path, string contentRootPath)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return null;
        }

        string configuredPath = Path.IsPathFullyQualified(path)
            ? path
            : Path.Combine(contentRootPath, path);

        return Path.GetFullPath(configuredPath);
    }
}
