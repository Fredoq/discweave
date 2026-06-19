using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Collection;

public sealed record VinylRecord : IMedium
{
    private VinylRecord(string formatDescription)
    {
        FormatDescription = formatDescription;
    }

    public OwnedItemType Type => OwnedItemType.Vinyl;

    public string Code => "vinyl";

    public string FormatDescription { get; }

    public string Description => FormatDescription;

    public static VinylRecord Create(string formatDescription)
    {
        return new VinylRecord(Guard.RequiredText(formatDescription, nameof(formatDescription), "vinyl_record.format_required"));
    }
}
