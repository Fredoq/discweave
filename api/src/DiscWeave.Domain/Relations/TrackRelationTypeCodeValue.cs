namespace DiscWeave.Domain.Relations;

public sealed record TrackRelationTypeCodeValue
{
    private TrackRelationTypeCodeValue(string value)
    {
        Value = value;
    }

    public string Value { get; }

    public static TrackRelationTypeCodeValue From(string value)
    {
        return new TrackRelationTypeCodeValue(
            TrackRelationTypeCode.Required(
                value,
                nameof(value),
                "track_relation.type_required",
                "track_relation.type_invalid"));
    }

    public override string ToString()
    {
        return Value;
    }
}
