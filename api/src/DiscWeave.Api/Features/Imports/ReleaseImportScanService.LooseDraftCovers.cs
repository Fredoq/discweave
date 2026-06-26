using DiscWeave.Domain.Imports;
using DiscWeave.Importing;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private static string? LooseCoverPath(
        ReleaseImportSession session,
        IReadOnlyList<ReleaseImportLooseFileCandidate> candidates)
    {
        string[] folders = DistinctHints(candidates.Select(candidate => NormalizeRelativePath(DirectoryRelativePath(candidate.RelativePath))));
        if (folders.Length != 1)
        {
            return null;
        }

        string directory = string.IsNullOrWhiteSpace(folders[0])
            ? session.SourceRoot
            : Path.Combine(session.SourceRoot, folders[0]);
        if (!Directory.Exists(directory))
        {
            return null;
        }

        FileInfo[] covers =
        [
            .. Directory.EnumerateFiles(directory, "*", SearchOption.TopDirectoryOnly)
                .Where(ReleaseImportFileRules.IsSupportedCover)
                .Select(path => new FileInfo(path))
        ];
        return covers.Length == 0
            ? null
            : covers
            .OrderBy(CoverPriority)
            .ThenByDescending(file => file.Length)
            .ThenBy(file => file.Name, StringComparer.OrdinalIgnoreCase)
            .First()
            .FullName;
    }

    private static int CoverPriority(FileInfo file)
    {
        string stem = Path.GetFileNameWithoutExtension(file.Name);
        return stem.ToLowerInvariant() switch
        {
            "cover" => 0,
            "folder" => 1,
            "front" => 2,
            _ => file.Name.StartsWith("AlbumArt", StringComparison.OrdinalIgnoreCase) &&
                file.Name.Contains("Large", StringComparison.OrdinalIgnoreCase)
                    ? 3
                    : 4
        };
    }
}
