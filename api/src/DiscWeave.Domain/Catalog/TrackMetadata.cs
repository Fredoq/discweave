using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Catalog;

public sealed record TrackMetadata
{
    private TrackMetadata(IOptionalValue<int>? versionYear, bool isOriginal)
    {
        VersionYear = versionYear ?? Optional.Missing<int>();
        IsOriginal = isOriginal;
    }

    public IOptionalValue<int> VersionYear { get; }

    public bool IsOriginal { get; }

    public static TrackMetadata Empty { get; } = new(Optional.Missing<int>(), false);

    public TrackMetadata WithVersionYear(int versionYear)
    {
        return versionYear is < 1000 or > 9999
            ? throw new DomainException("track.version_year_invalid", "Track version year must be a four-digit year")
            : new TrackMetadata(Optional.From(versionYear), IsOriginal);
    }

    public TrackMetadata WithoutVersionYear()
    {
        return new TrackMetadata(Optional.Missing<int>(), IsOriginal);
    }

    public TrackMetadata WithOriginalMarker(bool isOriginal)
    {
        return new TrackMetadata(VersionYear, isOriginal);
    }
}
