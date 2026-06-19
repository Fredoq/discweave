namespace DiscWeave.Domain.Collection;

public interface IMedium
{
    OwnedItemType Type { get; }

    string Code { get; }

    string Description { get; }
}
