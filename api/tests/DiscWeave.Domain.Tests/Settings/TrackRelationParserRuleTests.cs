using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Settings;

public sealed class TrackRelationParserRuleTests
{
    [Fact(DisplayName = "Track relation parser rule normalizes required text and stores parser settings")]
    public void Track_relation_parser_rule_normalizes_required_text_and_stores_parser_settings()
    {
        var rule = TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            " remixOf ",
            " Remix ",
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            90,
            TrackRelationParserRuleDirection.VariantToBase,
            10,
            isActive: true,
            isBuiltin: false);

        Assert.Equal("remixOf", rule.RelationTypeCode);
        Assert.Equal("Remix", rule.Alias);
        Assert.Equal(TrackRelationParserRuleMatchMode.ExactLastParentheticalToken, rule.MatchMode);
        Assert.Equal(90, rule.Confidence);
        Assert.Equal(TrackRelationParserRuleDirection.VariantToBase, rule.Direction);
        Assert.Equal(10, rule.SortOrder);
        Assert.True(rule.IsActive);
        Assert.False(rule.IsBuiltin);
    }

    [Theory(DisplayName = "Track relation parser rule validates confidence range")]
    [InlineData(-1)]
    [InlineData(101)]
    public void Track_relation_parser_rule_validates_confidence_range(int confidence)
    {
        DomainException exception = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            "remixOf",
            "Remix",
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            confidence,
            TrackRelationParserRuleDirection.VariantToBase,
            10,
            isActive: true,
            isBuiltin: false));

        Assert.Equal("track_relation_parser_rule.confidence_invalid", exception.Code);
    }

    [Fact(DisplayName = "Track relation parser rule validates required text and enum values")]
    public void Track_relation_parser_rule_validates_required_text_and_enum_values()
    {
        DomainException relationTypeException = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            " ",
            "Remix",
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            90,
            TrackRelationParserRuleDirection.VariantToBase,
            10,
            isActive: true,
            isBuiltin: false));
        DomainException aliasException = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            "remixOf",
            " ",
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            90,
            TrackRelationParserRuleDirection.VariantToBase,
            10,
            isActive: true,
            isBuiltin: false));
        DomainException matchModeException = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            "remixOf",
            "Remix",
            (TrackRelationParserRuleMatchMode)999,
            90,
            TrackRelationParserRuleDirection.VariantToBase,
            10,
            isActive: true,
            isBuiltin: false));
        DomainException directionException = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            "remixOf",
            "Remix",
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            90,
            (TrackRelationParserRuleDirection)999,
            10,
            isActive: true,
            isBuiltin: false));

        Assert.Equal("track_relation_parser_rule.relation_type_required", relationTypeException.Code);
        Assert.Equal("track_relation_parser_rule.alias_required", aliasException.Code);
        Assert.Equal("track_relation_parser_rule.match_mode_invalid", matchModeException.Code);
        Assert.Equal("track_relation_parser_rule.direction_invalid", directionException.Code);
    }

    [Theory(DisplayName = "Track relation parser rule requires code-like relation type codes")]
    [InlineData("bad code")]
    [InlineData("bad.code")]
    [InlineData("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")]
    public void Track_relation_parser_rule_requires_code_like_relation_type_codes(string relationTypeCode)
    {
        DomainException exception = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            relationTypeCode,
            "Remix",
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
            90,
            TrackRelationParserRuleDirection.VariantToBase,
            10,
            isActive: true,
            isBuiltin: false));

        Assert.Equal("track_relation_parser_rule.relation_type_invalid", exception.Code);
    }
}
