using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Catalog;

public sealed record ReleaseMetadata
{
    private ReleaseMetadata(
        string type,
        IOptionalValue<int>? year,
        IOptionalValue<DateOnly>? releaseDate,
        IOptionalValue<CoverImage>? coverImage)
    {
        Type = Guard.RequiredText(type, nameof(type), "release.type_required");
        Year = year ?? Optional.Missing<int>();
        ReleaseDate = releaseDate ?? Optional.Missing<DateOnly>();
        CoverImage = coverImage ?? Optional.Missing<CoverImage>();
    }

    public string Type { get; }

    public IOptionalValue<int> Year { get; }

    public IOptionalValue<DateOnly> ReleaseDate { get; }

    public IOptionalValue<CoverImage> CoverImage { get; }

    public static ReleaseMetadata Empty { get; } = new(
        "unknown",
        Optional.Missing<int>(),
        Optional.Missing<DateOnly>(),
        Optional.Missing<CoverImage>());

    public ReleaseMetadata WithType(string type)
    {
        return new ReleaseMetadata(type, Year, ReleaseDate, CoverImage);
    }

    public ReleaseMetadata WithType(ReleaseType type)
    {
        return WithType(type switch
        {
            ReleaseType.Unknown => "unknown",
            ReleaseType.Album => "album",
            ReleaseType.Ep => "ep",
            ReleaseType.Standalone => "standalone",
            ReleaseType.Compilation => "compilation",
            ReleaseType.Bootleg => "bootleg",
            ReleaseType.Mixtape => "mixtape",
            ReleaseType.Promo => "promo",
            ReleaseType.Other => "other",
            _ => throw new ArgumentOutOfRangeException(nameof(type), type, "Release type is not supported")
        });
    }

    public ReleaseMetadata WithReleaseYear(int year)
    {
        return new ReleaseMetadata(
            Type,
            Optional.From(Guard.Positive(year, nameof(year), "release.year_required")),
            ReleaseDate,
            CoverImage);
    }

    public ReleaseMetadata WithReleaseDate(DateOnly releaseDate)
    {
        return new ReleaseMetadata(Type, Year, Optional.From(releaseDate), CoverImage);
    }

    public ReleaseMetadata WithCoverImage(CoverImage coverImage)
    {
        ArgumentNullException.ThrowIfNull(coverImage);

        return new ReleaseMetadata(Type, Year, ReleaseDate, Optional.From(coverImage));
    }

    public ReleaseMetadata WithoutCoverImage()
    {
        return new ReleaseMetadata(Type, Year, ReleaseDate, Optional.Missing<CoverImage>());
    }
}
