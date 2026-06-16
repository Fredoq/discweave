using System.Runtime.CompilerServices;
using System.Text;
using DiscWeave.Domain.Settings;

[assembly: InternalsVisibleTo("DiscWeave.Api.Tests")]

namespace DiscWeave.Api.Features.Imports;

internal static class RelationSuggestionAnalyzer
{
    public static TitleToken? TrySplitLastParenthetical(string title)
    {
        string trimmedTitle = title.Trim();
        if (trimmedTitle.Length == 0 || trimmedTitle[^1] != ')')
        {
            return null;
        }

        int openingIndex = FindLastParentheticalOpeningIndex(trimmedTitle);
        if (openingIndex < 0)
        {
            return null;
        }

        string baseTitle = trimmedTitle[..openingIndex].Trim();
        string token = trimmedTitle[(openingIndex + 1)..^1].Trim();

        return string.IsNullOrWhiteSpace(baseTitle) || string.IsNullOrWhiteSpace(token)
            || !HasBalancedParentheses(baseTitle)
            ? null
            : new TitleToken(baseTitle, token);
    }

    public static string NormalizeTitle(string title)
    {
        var builder = new StringBuilder(title.Length);
        bool pendingSpace = false;

        foreach (char character in title.Trim())
        {
            if (char.IsWhiteSpace(character))
            {
                pendingSpace = builder.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                _ = builder.Append(' ');
                pendingSpace = false;
            }

            _ = builder.Append(char.ToLowerInvariant(character));
        }

        return builder.ToString();
    }

    public static string NormalizeTitleConservative(string title)
    {
        var builder = new StringBuilder(title.Length);
        bool pendingSpace = false;

        foreach (char character in title.Trim())
        {
            if (char.IsWhiteSpace(character) || char.IsPunctuation(character) || char.IsSymbol(character))
            {
                pendingSpace = builder.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                _ = builder.Append(' ');
                pendingSpace = false;
            }

            _ = builder.Append(char.ToLowerInvariant(character));
        }

        return builder.ToString();
    }

    public static TrackRelationParserRule? MatchRule(string token, IReadOnlyList<TrackRelationParserRule> rules)
    {
        string normalizedToken = NormalizeTitle(token);

        return rules
            .Where(rule => rule.IsActive && rule.MatchMode == TrackRelationParserRuleMatchMode.ExactLastParentheticalToken)
            .OrderBy(rule => rule.SortOrder)
            .ThenBy(rule => rule.RelationTypeCode, StringComparer.Ordinal)
            .ThenBy(rule => rule.Alias, StringComparer.Ordinal)
            .ThenBy(rule => rule.Id.Value)
            .FirstOrDefault(rule => NormalizeTitle(rule.Alias) == normalizedToken);
    }

    private static bool HasBalancedParentheses(string title)
    {
        int depth = 0;
        foreach (char character in title)
        {
            if (character == '(')
            {
                depth++;
            }
            else if (character == ')')
            {
                depth--;
                if (depth < 0)
                {
                    return false;
                }
            }
        }

        return depth == 0;
    }

    private static int FindLastParentheticalOpeningIndex(string title)
    {
        int depth = 0;
        for (int index = title.Length - 1; index >= 0; index--)
        {
            char character = title[index];
            if (character == ')')
            {
                depth++;
                continue;
            }

            if (character != '(')
            {
                continue;
            }

            depth--;
            if (depth == 0)
            {
                return index;
            }

            if (depth < 0)
            {
                return -1;
            }
        }

        return -1;
    }

    internal sealed record TitleToken(string BaseTitle, string Token);
}
