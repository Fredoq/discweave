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
            Settings(),
            State());

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
            Settings(confidence: confidence),
            State()));

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
            Settings(),
            State()));
        DomainException aliasException = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            "remixOf",
            " ",
            Settings(),
            State()));
        DomainException matchModeException = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            "remixOf",
            "Remix",
            Settings(matchMode: (TrackRelationParserRuleMatchMode)999),
            State()));
        DomainException directionException = Assert.Throws<DomainException>(() => TrackRelationParserRule.Create(
            CollectionId.New(),
            TrackRelationParserRuleId.New(),
            "remixOf",
            "Remix",
            Settings(direction: (TrackRelationParserRuleDirection)999),
            State()));

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
            Settings(),
            State()));

        Assert.Equal("track_relation_parser_rule.relation_type_invalid", exception.Code);
    }

    private static TrackRelationParserRuleSettings Settings(
        TrackRelationParserRuleMatchMode matchMode = TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
        int confidence = 90,
        TrackRelationParserRuleDirection direction = TrackRelationParserRuleDirection.VariantToBase,
        int sortOrder = 10)
    {
        return new TrackRelationParserRuleSettings
        {
            MatchMode = matchMode,
            Confidence = confidence,
            Direction = direction,
            SortOrder = sortOrder
        };
    }

    private static TrackRelationParserRuleState State(
        bool isActive = true,
        bool isBuiltin = false)
    {
        return new TrackRelationParserRuleState
        {
            IsActive = isActive,
            IsBuiltin = isBuiltin
        };
    }
}
