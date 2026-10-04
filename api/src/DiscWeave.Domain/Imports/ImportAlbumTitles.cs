using System.Text.RegularExpressions;

namespace DiscWeave.Domain.Imports;

public static partial class ImportAlbumTitles
{
    /// <summary>
    /// Removes a trailing disc or part marker that taggers commonly append to album titles of
    /// multi-disc releases, such as "Album Cd2", "Album (Disc 1)", or "Album [CD 2/3]".
    /// </summary>
    public static string WithoutDiscSuffix(string albumTitle)
    {
        ArgumentNullException.ThrowIfNull(albumTitle);

        string trimmed = albumTitle.Trim();
        string stripped = DiscSuffixRegex().Replace(trimmed, string.Empty).Trim();
        return stripped.Length == 0 ? trimmed : stripped;
    }

    [GeneratedRegex(
        "[\\s,:\\-–—]*[\\(\\[]?\\s*(?:cd|disc|disk|part)\\s*\\d{1,3}(?:\\s*(?:of|/)\\s*\\d{1,3})?\\s*[\\)\\]]?$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant,
        matchTimeoutMilliseconds: 100)]
    private static partial Regex DiscSuffixRegex();
}
