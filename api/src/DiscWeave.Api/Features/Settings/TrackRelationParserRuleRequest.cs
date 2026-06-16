namespace DiscWeave.Api.Features.Settings;

public sealed record TrackRelationParserRuleRequest(
    string RelationTypeCode,
    string Alias,
    string MatchMode,
    int Confidence,
    string Direction,
    int? SortOrder,
    bool? IsActive);
