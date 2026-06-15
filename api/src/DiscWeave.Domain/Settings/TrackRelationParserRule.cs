using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Settings;

public sealed class TrackRelationParserRule : IEntity<TrackRelationParserRuleId>
{
    private TrackRelationParserRule()
    {
    }

    private TrackRelationParserRule(
        CollectionId collectionId,
        TrackRelationParserRuleId id,
        string relationTypeCode,
        string alias,
        TrackRelationParserRuleMatchMode matchMode,
        int confidence,
        TrackRelationParserRuleDirection direction,
        int sortOrder,
        bool isActive,
        bool isBuiltin)
    {
        CollectionId = collectionId;
        Id = id;
        RelationTypeCode = TrackRelationTypeCode.Required(
            relationTypeCode,
            nameof(relationTypeCode),
            "track_relation_parser_rule.relation_type_required",
            "track_relation_parser_rule.relation_type_invalid");
        Alias = Guard.RequiredText(alias, nameof(alias), "track_relation_parser_rule.alias_required");
        MatchMode = Guard.DefinedEnum(matchMode, nameof(matchMode), "track_relation_parser_rule.match_mode_invalid");
        Confidence = RequiredConfidence(confidence);
        Direction = Guard.DefinedEnum(direction, nameof(direction), "track_relation_parser_rule.direction_invalid");
        SortOrder = RequiredSortOrder(sortOrder);
        IsActive = isActive;
        IsBuiltin = isBuiltin;
    }

    public TrackRelationParserRuleId Id { get; private set; }

    public CollectionId CollectionId { get; private set; }

    public string RelationTypeCode { get; private set; } = string.Empty;

    public string Alias { get; private set; } = string.Empty;

    public TrackRelationParserRuleMatchMode MatchMode { get; private set; }

    public int Confidence { get; private set; }

    public TrackRelationParserRuleDirection Direction { get; private set; }

    public int SortOrder { get; private set; }

    public bool IsActive { get; private set; }

    public bool IsBuiltin { get; private set; }

    public static TrackRelationParserRule Create(
        CollectionId collectionId,
        TrackRelationParserRuleId id,
        string relationTypeCode,
        string alias,
        TrackRelationParserRuleMatchMode matchMode,
        int confidence,
        TrackRelationParserRuleDirection direction,
        int sortOrder,
        bool isActive,
        bool isBuiltin)
    {
        return new TrackRelationParserRule(
            collectionId,
            id,
            relationTypeCode,
            alias,
            matchMode,
            confidence,
            direction,
            sortOrder,
            isActive,
            isBuiltin);
    }

    public void Update(
        string relationTypeCode,
        string alias,
        TrackRelationParserRuleMatchMode matchMode,
        int confidence,
        TrackRelationParserRuleDirection direction,
        int sortOrder,
        bool isActive)
    {
        RelationTypeCode = TrackRelationTypeCode.Required(
            relationTypeCode,
            nameof(relationTypeCode),
            "track_relation_parser_rule.relation_type_required",
            "track_relation_parser_rule.relation_type_invalid");
        Alias = Guard.RequiredText(alias, nameof(alias), "track_relation_parser_rule.alias_required");
        MatchMode = Guard.DefinedEnum(matchMode, nameof(matchMode), "track_relation_parser_rule.match_mode_invalid");
        Confidence = RequiredConfidence(confidence);
        Direction = Guard.DefinedEnum(direction, nameof(direction), "track_relation_parser_rule.direction_invalid");
        SortOrder = RequiredSortOrder(sortOrder);
        IsActive = isActive;
    }

    public void EnsureCanDelete()
    {
        if (IsBuiltin)
        {
            throw new DomainException("track_relation_parser_rule.builtin_immutable", "Built-in track relation parser rules cannot be deleted");
        }
    }

    private static int RequiredConfidence(int confidence)
    {
        return confidence is < 0 or > 100
            ? throw new DomainException("track_relation_parser_rule.confidence_invalid", "Track relation parser rule confidence must be between 0 and 100")
            : confidence;
    }

    private static int RequiredSortOrder(int sortOrder)
    {
        return sortOrder < 0
            ? throw new DomainException("track_relation_parser_rule.sort_order_invalid", "Track relation parser rule sort order cannot be negative")
            : sortOrder;
    }
}
