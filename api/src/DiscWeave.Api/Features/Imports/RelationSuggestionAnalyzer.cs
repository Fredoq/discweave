using System.Runtime.CompilerServices;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.Settings;

[assembly: InternalsVisibleTo("DiscWeave.Api.Tests")]

namespace DiscWeave.Api.Features.Imports;

internal static class RelationSuggestionAnalyzer
{
    public static TitleToken? TrySplitLastParenthetical(string title)
    {
        OriginalVersionMarkerMatcher.TitleToken? result =
            OriginalVersionMarkerMatcher.TrySplitLastParenthetical(title);

        return result is null
            ? null
            : new TitleToken
            {
                BaseTitle = result.BaseTitle,
                Token = result.Token
            };
    }

    public static string NormalizeTitle(string title)
    {
        return OriginalDiscoveryTextNormalizer.ForParserToken(title);
    }

    public static string NormalizeTitleConservative(string title)
    {
        return OriginalDiscoveryTextNormalizer.ForTitleKey(title);
    }

    public static TrackRelationParserRule? MatchRule(string token, IReadOnlyList<TrackRelationParserRule> rules)
    {
        return OriginalVersionMarkerMatcher.MatchRule(token, rules);
    }

    internal sealed record TitleToken
    {
        public required string BaseTitle { get; init; }
        public required string Token { get; init; }
    }
}
