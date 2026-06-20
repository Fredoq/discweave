namespace DiscWeave.Domain.Collection;

public sealed record DigitalFile : IMedium
{
    private DigitalFile()
    {
    }

    public OwnedItemType Type => OwnedItemType.Digital;

    public string Code => "digital";

    public string Description => "digital release copy";

    public static DigitalFile Create()
    {
        return new DigitalFile();
    }
}
