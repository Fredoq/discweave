using DiscWeave.Domain.Settings;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public static class OriginalVersionMarkerMatcher
{
    public static TitleToken? TrySplitLastParenthetical(string title)
    {
        ArgumentNullException.ThrowIfNull(title);

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
            : new TitleToken
            {
                BaseTitle = baseTitle,
                Token = token
            };
    }

    public static TrackRelationParserRule? MatchRule(
        string token,
        IReadOnlyList<TrackRelationParserRule> rules)
    {
        ArgumentNullException.ThrowIfNull(token);
        ArgumentNullException.ThrowIfNull(rules);

        string normalizedToken = OriginalDiscoveryTextNormalizer.ForParserToken(token);

        return rules
            .Where(rule => rule.IsActive
                && rule.MatchMode == TrackRelationParserRuleMatchMode.ExactLastParentheticalToken)
            .OrderBy(rule => rule.SortOrder)
            .ThenBy(rule => rule.RelationTypeCode, StringComparer.Ordinal)
            .ThenBy(rule => rule.Alias, StringComparer.Ordinal)
            .ThenBy(rule => rule.Id.Value)
            .FirstOrDefault(rule =>
                OriginalDiscoveryTextNormalizer.ForParserToken(rule.Alias) == normalizedToken);
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

    public sealed record TitleToken
    {
        public required string BaseTitle { get; init; }
        public required string Token { get; init; }
    }
}
