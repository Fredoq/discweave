namespace DiscWeave.Domain.SharedKernel.Ids;

public readonly record struct CollectionReviewIssueStateId(Guid Value)
{
    public static CollectionReviewIssueStateId New()
    {
        return new CollectionReviewIssueStateId(Guid.CreateVersion7());
    }

    public override string ToString()
    {
        return Value.ToString();
    }
}
