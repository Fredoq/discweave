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

        int depth = 0;
        for (int index = trimmedTitle.Length - 1; index >= 0; index--)
        {
            char character = trimmedTitle[index];
            if (character == ')')
            {
                depth++;
            }
            else if (character == '(')
            {
                depth--;
                if (depth == 0)
                {
                    string baseTitle = trimmedTitle[..index].Trim();
                    string token = trimmedTitle[(index + 1)..^1].Trim();

                    return string.IsNullOrWhiteSpace(baseTitle) || string.IsNullOrWhiteSpace(token)
                        ? null
                        : new TitleToken(baseTitle, token);
                }

                if (depth < 0)
                {
                    return null;
                }
            }
        }

        return null;
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

    public static TrackRelationParserRule? MatchRule(string token, IReadOnlyList<TrackRelationParserRule> rules)
    {
        string normalizedToken = NormalizeTitle(token);

        return rules
            .Where(rule => rule.IsActive && rule.MatchMode == TrackRelationParserRuleMatchMode.ExactLastParentheticalToken)
            .OrderBy(rule => rule.SortOrder)
            .FirstOrDefault(rule => NormalizeTitle(rule.Alias) == normalizedToken);
    }

    internal sealed record TitleToken(string BaseTitle, string Token);
}
