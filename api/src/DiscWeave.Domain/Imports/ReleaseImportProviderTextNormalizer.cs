using System.Text;

namespace DiscWeave.Domain.Imports;

internal static class ReleaseImportProviderTextNormalizer
{
    public static string Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = new StringBuilder(value.Length);
        bool pendingSpace = false;
        foreach (Rune rune in value.Normalize(NormalizationForm.FormKC)
            .ToLowerInvariant()
            .EnumerateRunes())
        {
            if (Rune.IsWhiteSpace(rune))
            {
                pendingSpace = normalized.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                _ = normalized.Append(' ');
                pendingSpace = false;
            }

            _ = normalized.Append(rune);
        }

        return normalized.ToString();
    }
}
