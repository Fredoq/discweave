using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Domain.Relations;

public sealed record ArtistRelationIdentity(string Value)
{
    public static ArtistRelationIdentity WithoutPeriod(
        ArtistId sourceArtistId,
        ArtistId targetArtistId,
        string type)
    {
        return FromYearParts(sourceArtistId, targetArtistId, type, null, null);
    }

    public static ArtistRelationIdentity FromPeriod(
        ArtistId sourceArtistId,
        ArtistId targetArtistId,
        string type,
        ArtistRelationPeriod period)
    {
        ArgumentNullException.ThrowIfNull(period);

        int? startYear = period.StartYear is PresentOptionalValue<int> presentStartYear ? presentStartYear.Value : null;
        int? endYear = period.EndYear is PresentOptionalValue<int> presentEndYear ? presentEndYear.Value : null;
        return FromYearParts(sourceArtistId, targetArtistId, type, startYear, endYear);
    }

    private static ArtistRelationIdentity FromYearParts(
        ArtistId sourceArtistId,
        ArtistId targetArtistId,
        string type,
        int? periodStartYear,
        int? periodEndYear)
    {
        return new ArtistRelationIdentity(
            $"{sourceArtistId.Value:D}|{targetArtistId.Value:D}|{type}|{FormatYear(periodStartYear)}|{FormatYear(periodEndYear)}");
    }

    private static string FormatYear(int? year)
    {
        return year is { } value ? value.ToString(System.Globalization.CultureInfo.InvariantCulture) : "none";
    }
}
