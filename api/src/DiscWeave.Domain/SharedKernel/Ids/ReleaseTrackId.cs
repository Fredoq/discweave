namespace DiscWeave.Domain.SharedKernel.Ids;

public readonly record struct ReleaseTrackId(Guid Value)
{
    public static ReleaseTrackId New()
    {
        return new ReleaseTrackId(Guid.CreateVersion7());
    }

    public override string ToString()
    {
        return Value.ToString();
    }
}
