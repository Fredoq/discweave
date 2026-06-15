using DiscWeave.Api.Features.Imports;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class DesktopImportRelationSuggestionTests
{
    [Fact(DisplayName = "Relation suggestion analyzer extracts the last parenthetical token")]
    public void Relation_suggestion_analyzer_extracts_the_last_parenthetical_token()
    {
        RelationSuggestionAnalyzer.TitleToken? result = RelationSuggestionAnalyzer.TrySplitLastParenthetical(
            "It's Like That (Drop The Break) (Radio Edit)");

        Assert.NotNull(result);
        Assert.Equal("It's Like That (Drop The Break)", result.BaseTitle);
        Assert.Equal("Radio Edit", result.Token);
    }

    [Theory(DisplayName = "Relation suggestion analyzer ignores titles without final parenthetical tokens")]
    [InlineData("It's Like That")]
    [InlineData("It's Like That (Radio Edit) bonus")]
    [InlineData("It's Like That (Radio Edit")]
    [InlineData("It's Like That (unfinished (Radio Edit)")]
    public void Relation_suggestion_analyzer_ignores_titles_without_final_parenthetical_tokens(string title)
    {
        RelationSuggestionAnalyzer.TitleToken? result = RelationSuggestionAnalyzer.TrySplitLastParenthetical(title);

        Assert.Null(result);
    }

    [Theory(DisplayName = "Relation suggestion analyzer ignores empty base titles or tokens")]
    [InlineData("(Radio Edit)")]
    [InlineData("It's Like That ()")]
    [InlineData("It's Like That (   )")]
    public void Relation_suggestion_analyzer_ignores_empty_base_titles_or_tokens(string title)
    {
        RelationSuggestionAnalyzer.TitleToken? result = RelationSuggestionAnalyzer.TrySplitLastParenthetical(title);

        Assert.Null(result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer normalizes whitespace and case")]
    public void Relation_suggestion_analyzer_normalizes_whitespace_and_case()
    {
        string result = RelationSuggestionAnalyzer.NormalizeTitle("  Radio\t\n  EDIT  ");

        Assert.Equal("radio edit", result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer conservatively folds punctuation")]
    public void Relation_suggestion_analyzer_conservatively_folds_punctuation()
    {
        string result = RelationSuggestionAnalyzer.NormalizeTitleConservative("  It's--Like:That  ");

        Assert.Equal("it s like that", result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer matches active aliases by normalized token")]
    public void Relation_suggestion_analyzer_matches_active_aliases_by_normalized_token()
    {
        TrackRelationParserRule expectedRule = CreateRule(alias: "Radio   Edit", sortOrder: 10);
        TrackRelationParserRule[] rules =
        [
            CreateRule(alias: "Dub", sortOrder: 5),
            expectedRule
        ];

        TrackRelationParserRule? result = RelationSuggestionAnalyzer.MatchRule(" radio\tEDIT ", rules);

        Assert.Same(expectedRule, result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer ignores inactive rules and prefers the lowest sort order")]
    public void Relation_suggestion_analyzer_ignores_inactive_rules_and_prefers_the_lowest_sort_order()
    {
        TrackRelationParserRule inactiveRule = CreateRule(alias: "Radio Edit", sortOrder: 1, isActive: false);
        TrackRelationParserRule expectedRule = CreateRule(alias: "Radio Edit", sortOrder: 5);
        TrackRelationParserRule laterRule = CreateRule(alias: "Radio Edit", sortOrder: 10);
        TrackRelationParserRule[] rules = [laterRule, inactiveRule, expectedRule];

        TrackRelationParserRule? result = RelationSuggestionAnalyzer.MatchRule("Radio Edit", rules);

        Assert.Same(expectedRule, result);
    }

    [Fact(DisplayName = "Relation suggestion analyzer resolves equal sort order matches deterministically")]
    public void Relation_suggestion_analyzer_resolves_equal_sort_order_matches_deterministically()
    {
        TrackRelationParserRule laterAliasRule = CreateRule("versionOf", alias: "radio edit", sortOrder: 10);
        TrackRelationParserRule laterTypeRule = CreateRule("remixOf", alias: "Radio Edit", sortOrder: 10);
        TrackRelationParserRule expectedRule = CreateRule("editOf", alias: "Radio Edit", sortOrder: 10);
        TrackRelationParserRule[] rules = [laterAliasRule, laterTypeRule, expectedRule];

        TrackRelationParserRule? result = RelationSuggestionAnalyzer.MatchRule("Radio Edit", rules);

        Assert.Same(expectedRule, result);
    }

    private static TrackRelationParserRule CreateRule(string alias, int sortOrder, bool isActive = true)
    {
        return CreateRule("editOf", alias, sortOrder, isActive);
    }

    private static TrackRelationParserRule CreateRule(
        string relationTypeCode,
        string alias,
        int sortOrder,
        bool isActive = true)
    {
        return TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            relationTypeCode,
            alias,
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            confidence: 90,
            TrackRelationParserRuleDirection.VariantToBase,
            sortOrder,
            isActive,
            isBuiltin: false);
    }
}
