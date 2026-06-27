using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Relations;

public sealed record ArtistRelationIdentity(string Value)
{
    public static ArtistRelationIdentity From(
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
