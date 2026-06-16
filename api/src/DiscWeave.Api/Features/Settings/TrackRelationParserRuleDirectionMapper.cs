using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Api.Features.Settings;

internal static class TrackRelationParserRuleDirectionMapper
{
    public static TrackRelationParserRuleDirection Parse(string direction)
    {
        return string.IsNullOrWhiteSpace(direction)
            ? throw new DomainException("track_relation_parser_rule.direction_invalid", "Track relation parser rule direction is invalid")
            : direction.Trim() switch
            {
                "variantToBase" => TrackRelationParserRuleDirection.VariantToBase,
                "baseToVariant" => TrackRelationParserRuleDirection.BaseToVariant,
                _ => throw new DomainException("track_relation_parser_rule.direction_invalid", "Track relation parser rule direction is invalid")
            };
    }

    public static string ToCode(TrackRelationParserRuleDirection direction)
    {
        return direction switch
        {
            TrackRelationParserRuleDirection.VariantToBase => "variantToBase",
            TrackRelationParserRuleDirection.BaseToVariant => "baseToVariant",
            _ => throw new InvalidOperationException("Track relation parser rule direction is not supported")
        };
    }
}
