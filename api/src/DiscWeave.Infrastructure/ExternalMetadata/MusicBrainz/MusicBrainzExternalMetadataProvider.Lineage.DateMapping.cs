using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private static ProviderPartialDate? ParseProviderPartialDate(string? value)
    {
        string? normalized = EmptyToNull(value);
        if (normalized is null)
        {
            return null;
        }

        string[] parts = normalized.Split('-', StringSplitOptions.None);
        if (parts.Length is < 1 or > 3 ||
            !int.TryParse(parts[0], NumberStyles.None, CultureInfo.InvariantCulture, out int year) ||
            year is < 1 or > 9999)
        {
            return null;
        }

        int? month = TryParseDatePart(parts, 1, 1, 12);
        int? day = TryParseDatePart(parts, 2, 1, 31);
        return (parts.Length > 1 && month is null) ||
            (parts.Length > 2 && day is null) ||
            (month is int validMonth &&
                day is int validDay &&
                validDay > DateTime.DaysInMonth(year, validMonth))
                ? null
                : new ProviderPartialDate
                {
                    Year = year,
                    Month = month,
                    Day = day
                };
    }

    private static int? TryParseDatePart(string[] parts, int index, int minimum, int maximum)
    {
        return parts.Length > index &&
            int.TryParse(parts[index], NumberStyles.None, CultureInfo.InvariantCulture, out int value) &&
            value >= minimum &&
            value <= maximum
                ? value
                : null;
    }
}
