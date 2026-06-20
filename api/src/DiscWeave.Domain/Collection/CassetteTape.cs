using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Collection;

public sealed record CassetteTape : IMedium
{
    private CassetteTape(string tapeType)
    {
        TapeType = tapeType;
    }

    public OwnedItemType Type => OwnedItemType.Cassette;

    public string Code => "cassette";

    public string TapeType { get; }

    public string Description => TapeType;

    public static CassetteTape Create(string tapeType)
    {
        return new CassetteTape(Guard.RequiredText(tapeType, nameof(tapeType), "cassette_tape.type_required"));
    }
}
