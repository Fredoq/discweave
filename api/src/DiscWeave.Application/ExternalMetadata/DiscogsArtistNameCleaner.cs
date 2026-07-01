using System.Text.RegularExpressions;

namespace DiscWeave.Application.ExternalMetadata;

public static partial class DiscogsArtistNameCleaner
{
    public static string Clean(string? name)
    {
        string trimmed = name?.Trim() ?? string.Empty;
        if (trimmed.Length == 0)
        {
            return string.Empty;
        }

        string cleaned = DiscogsDisambiguationSuffix().Replace(trimmed, string.Empty).Trim();
        return cleaned.Length == 0 ? trimmed : cleaned;
    }

    [GeneratedRegex(@"\s+\([1-9]\d*\)$", RegexOptions.CultureInvariant)]
    private static partial Regex DiscogsDisambiguationSuffix();
}
