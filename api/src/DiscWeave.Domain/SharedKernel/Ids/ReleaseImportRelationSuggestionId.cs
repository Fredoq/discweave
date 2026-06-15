namespace DiscWeave.Domain.SharedKernel.Ids;

public readonly record struct ReleaseImportRelationSuggestionId(Guid Value)
{
    public static ReleaseImportRelationSuggestionId New()
    {
        return new ReleaseImportRelationSuggestionId(Guid.CreateVersion7());
    }

    public override string ToString()
    {
        return Value.ToString();
    }
}
