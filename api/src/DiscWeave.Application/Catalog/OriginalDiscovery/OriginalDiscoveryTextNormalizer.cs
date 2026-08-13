using System.Globalization;
using System.Text;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public static class OriginalDiscoveryTextNormalizer
{
    public static string NormalizeWhitespace(string value)
    {
        return Normalize(value, foldPunctuationAndSymbols: false, foldCase: false);
    }

    public static string ForTitleKey(string title)
    {
        return Normalize(title, foldPunctuationAndSymbols: true, foldCase: true);
    }

    public static string ForArtistKey(string artist)
    {
        return Normalize(artist, foldPunctuationAndSymbols: true, foldCase: true);
    }

    public static string ForParserToken(string token)
    {
        return Normalize(token, foldPunctuationAndSymbols: false, foldCase: true);
    }

    private static string Normalize(string value, bool foldPunctuationAndSymbols, bool foldCase)
    {
        ArgumentNullException.ThrowIfNull(value);

        string normalized = value.Normalize(NormalizationForm.FormKC);
        var builder = new StringBuilder(normalized.Length);
        bool pendingSpace = false;

        foreach (Rune sourceRune in normalized.EnumerateRunes())
        {
            Rune rune = foldCase ? Rune.ToLowerInvariant(sourceRune) : sourceRune;
            if (Rune.IsWhiteSpace(rune)
                || (foldPunctuationAndSymbols && IsPunctuationOrSymbol(rune)))
            {
                pendingSpace = builder.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                _ = builder.Append(' ');
                pendingSpace = false;
            }

            _ = builder.Append(rune.ToString());
        }

        return builder.ToString();
    }

    private static bool IsPunctuationOrSymbol(Rune rune)
    {
        UnicodeCategory category = Rune.GetUnicodeCategory(rune);
        return category is
            UnicodeCategory.ConnectorPunctuation
            or UnicodeCategory.DashPunctuation
            or UnicodeCategory.OpenPunctuation
            or UnicodeCategory.ClosePunctuation
            or UnicodeCategory.InitialQuotePunctuation
            or UnicodeCategory.FinalQuotePunctuation
            or UnicodeCategory.OtherPunctuation
            or UnicodeCategory.MathSymbol
            or UnicodeCategory.CurrencySymbol
            or UnicodeCategory.ModifierSymbol
            or UnicodeCategory.OtherSymbol;
    }
}
