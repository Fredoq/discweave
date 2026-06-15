using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Api.Features.Settings;

internal static class TrackRelationParserRuleMatchModeMapper
{
    public static TrackRelationParserRuleMatchMode Parse(string matchMode)
    {
        return string.IsNullOrWhiteSpace(matchMode)
            ? throw new DomainException("track_relation_parser_rule.match_mode_invalid", "Track relation parser rule match mode is invalid")
            : matchMode.Trim() switch
            {
                "exactLastParentheticalToken" => TrackRelationParserRuleMatchMode.ExactLastParentheticalToken,
                _ => throw new DomainException("track_relation_parser_rule.match_mode_invalid", "Track relation parser rule match mode is invalid")
            };
    }

    public static string ToCode(TrackRelationParserRuleMatchMode matchMode)
    {
        return matchMode switch
        {
            TrackRelationParserRuleMatchMode.ExactLastParentheticalToken => "exactLastParentheticalToken",
            _ => throw new InvalidOperationException("Track relation parser rule match mode is not supported")
        };
    }
}
