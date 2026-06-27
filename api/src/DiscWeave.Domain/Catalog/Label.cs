using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;

namespace DiscWeave.Domain.Catalog;

public sealed class Label : IEntity<LabelId>, INamedEntity
{
    private Label(CollectionId collectionId, LabelId id, string name)
    {
        CollectionId = collectionId;
        Id = id;
        SetName(name);
    }

    public CollectionId CollectionId { get; }

    public LabelId Id { get; }

    public string Name { get; private set; } = string.Empty;

    public string NameKey { get; private set; } = string.Empty;

    public static Label Create(CollectionId collectionId, LabelId id, string name)
    {
        return new Label(collectionId, id, name);
    }

    public void Rename(string name)
    {
        SetName(name);
    }

    private void SetName(string name)
    {
        Name = LabelName.NormalizeDisplayName(name);
        NameKey = LabelName.NormalizeKey(name);
    }
}
