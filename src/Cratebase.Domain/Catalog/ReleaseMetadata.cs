using Cratebase.Domain.SharedKernel.Ids;
using Cratebase.Domain.SharedKernel.Optional;
using Cratebase.Domain.SharedKernel.Validation;

namespace Cratebase.Domain.Catalog;

public sealed record ReleaseMetadata
{
    private ReleaseMetadata(
        ReleaseType type,
        IOptionalValue<LabelId>? labelId,
        IOptionalValue<int>? year,
        IOptionalValue<DateOnly>? releaseDate,
        IOptionalValue<CoverImage>? coverImage)
    {
        Type = type;
        LabelId = labelId ?? Optional.Missing<LabelId>();
        Year = year ?? Optional.Missing<int>();
        ReleaseDate = releaseDate ?? Optional.Missing<DateOnly>();
        CoverImage = coverImage ?? Optional.Missing<CoverImage>();
    }

    public ReleaseType Type { get; }

    public IOptionalValue<LabelId> LabelId { get; }

    public IOptionalValue<int> Year { get; }

    public IOptionalValue<DateOnly> ReleaseDate { get; }

    public IOptionalValue<CoverImage> CoverImage { get; }

    public static ReleaseMetadata Empty { get; } = new(
        ReleaseType.Unknown,
        Optional.Missing<LabelId>(),
        Optional.Missing<int>(),
        Optional.Missing<DateOnly>(),
        Optional.Missing<CoverImage>());

    public ReleaseMetadata WithType(ReleaseType type)
    {
        return new ReleaseMetadata(type, LabelId, Year, ReleaseDate, CoverImage);
    }

    public ReleaseMetadata WithLabel(LabelId labelId)
    {
        return new ReleaseMetadata(Type, Optional.From(labelId), Year, ReleaseDate, CoverImage);
    }

    public ReleaseMetadata WithReleaseYear(int year)
    {
        return new ReleaseMetadata(
            Type,
            LabelId,
            Optional.From(Guard.Positive(year, nameof(year), "release.year_required")),
            ReleaseDate,
            CoverImage);
    }

    public ReleaseMetadata WithReleaseDate(DateOnly releaseDate)
    {
        return new ReleaseMetadata(Type, LabelId, Year, Optional.From(releaseDate), CoverImage);
    }

    public ReleaseMetadata WithCoverImage(CoverImage coverImage)
    {
        ArgumentNullException.ThrowIfNull(coverImage);

        return new ReleaseMetadata(Type, LabelId, Year, ReleaseDate, Optional.From(coverImage));
    }
}
