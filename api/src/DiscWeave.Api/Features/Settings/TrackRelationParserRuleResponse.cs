namespace DiscWeave.Api.Features.Settings;

public sealed record TrackRelationParserRuleResponse(
    Guid Id,
    string RelationTypeCode,
    string Alias,
    string MatchMode,
    int Confidence,
    string Direction,
    int SortOrder,
    bool IsActive,
    bool IsBuiltin);
