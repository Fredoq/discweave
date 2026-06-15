namespace DiscWeave.Domain.SharedKernel.Ids;

public readonly record struct TrackRelationParserRuleId(Guid Value)
{
    public static TrackRelationParserRuleId New()
    {
        return new TrackRelationParserRuleId(Guid.CreateVersion7());
    }

    public override string ToString()
    {
        return Value.ToString();
    }
}
