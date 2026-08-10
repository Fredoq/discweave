using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Settings;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class LocalOriginalCandidateDataSource
{
    private static bool SharesBaseTitle(
        Track source,
        Track candidate,
        IReadOnlyList<TrackRelationParserRule> parserRules)
    {
        return string.Equals(
            OriginalDiscoveryTextNormalizer.ForTitleKey(
                BaseTitle(source.Title, parserRules)),
            OriginalDiscoveryTextNormalizer.ForTitleKey(
                BaseTitle(candidate.Title, parserRules)),
            StringComparison.Ordinal);
    }

    private static string BaseTitle(
        string title,
        IReadOnlyList<TrackRelationParserRule> parserRules)
    {
        OriginalVersionMarkerMatcher.TitleToken? token =
            OriginalVersionMarkerMatcher.TrySplitLastParenthetical(title);
        TrackRelationParserRule? rule = token is null
            ? null
            : OriginalVersionMarkerMatcher.MatchRule(token.Token, parserRules);
        return rule is null ? title.Trim() : token!.BaseTitle;
    }
}
