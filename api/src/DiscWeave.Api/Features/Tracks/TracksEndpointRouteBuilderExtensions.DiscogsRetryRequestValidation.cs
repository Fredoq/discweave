using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static bool TryMapSources(
        IReadOnlyList<ExternalOriginalCandidateSourceResponse> data,
        string providerCode,
        string resourceType,
        out ExternalMetadataSource[] sources)
    {
        var mapped = new List<ExternalMetadataSource>(data.Count);
        foreach (ExternalOriginalCandidateSourceResponse source in data)
        {
            if (!TryMapSource(
                source,
                providerCode,
                resourceType,
                out ExternalMetadataSource value))
            {
                sources = [];
                return false;
            }

            mapped.Add(value);
        }

        sources = [.. mapped];
        return true;
    }

    private static bool TryMapSource(
        ExternalOriginalCandidateSourceResponse? data,
        string providerCode,
        string resourceType,
        out ExternalMetadataSource source)
    {
        source = null!; // NOSONAR: the value is consumed only when this method returns true.
        bool validId = providerCode == "musicbrainz"
            ? IsCanonicalMbid(data?.ExternalId)
            : TryPositiveCanonicalInteger(data?.ExternalId);
        string? expectedUrl = providerCode == "musicbrainz"
            ? $"https://musicbrainz.org/{resourceType}/{data?.ExternalId}"
            : $"https://www.discogs.com/{resourceType}/{data?.ExternalId}";
        if (data is null ||
            !validId ||
            !string.Equals(data.ProviderCode, providerCode, StringComparison.Ordinal) ||
            !string.Equals(data.ResourceType, resourceType, StringComparison.Ordinal) ||
            !string.Equals(data.SourceUrl, expectedUrl, StringComparison.Ordinal))
        {
            return false;
        }

        source = new ExternalMetadataSource(
            providerCode,
            resourceType,
            data.ExternalId,
            expectedUrl,
            providerCode == "musicbrainz"
                ? "Data provided by MusicBrainz."
                : "Data provided by Discogs.");
        return true;
    }

    private static bool TryMapProviderDate(
        ExternalOriginalCandidatePartialDateResponse? data,
        out ProviderPartialDate? date)
    {
        date = null;
        if (data is null)
        {
            return true;
        }

        if (!TryCreateDate(data.Year, data.Month, data.Day, out _))
        {
            return false;
        }

        date = new ProviderPartialDate
        {
            Year = data.Year,
            Month = data.Month,
            Day = data.Day
        };
        return true;
    }

    private static bool TryMapEvidence(
        DiscogsOriginalRouteRetryRequest.PartialDateData? data,
        out IOptionalValue<ExternalMetadataPartialDate> evidence)
    {
        evidence = Optional.Missing<ExternalMetadataPartialDate>();
        if (data is null)
        {
            return true;
        }

        if (!TryCreateDate(
            data.Year,
            data.Month,
            data.Day,
            out ExternalMetadataPartialDate? date))
        {
            return false;
        }

        bool kindMatches = data.Kind switch
        {
            "year" => date is ExternalMetadataPartialDate.YearOnly,
            "yearMonth" => date is ExternalMetadataPartialDate.YearMonth,
            "fullDate" => date is ExternalMetadataPartialDate.FullDate,
            _ => false
        };
        if (!kindMatches)
        {
            return false;
        }

        evidence = Optional.From(date!); // NOSONAR: date is present on this branch.
        return true;
    }

    private static bool TryCreateDate(
        int year,
        int? month,
        int? day,
        out ExternalMetadataPartialDate? date)
    {
        try
        {
            date = (month, day) switch
            {
                (null, null) => ExternalMetadataPartialDate.ForYear(year),
                (int monthValue, null) =>
                    ExternalMetadataPartialDate.ForYearMonth(year, monthValue),
                (int monthValue, int dayValue) =>
                    ExternalMetadataPartialDate.ForDate(
                        new DateOnly(year, monthValue, dayValue)),
                _ => null
            };
            return date is not null;
        }
        catch (ArgumentOutOfRangeException)
        {
            date = null;
            return false;
        }
    }

    private static bool TryMapDuration(
        long? milliseconds,
        out TimeSpan? duration)
    {
        duration = null;
        if (milliseconds is null)
        {
            return true;
        }

        if (milliseconds <= 0 ||
            milliseconds > TimeSpan.MaxValue.TotalMilliseconds)
        {
            return false;
        }

        duration = TimeSpan.FromMilliseconds(milliseconds.Value);
        return true;
    }

    private static bool IsCanonicalMbid(string? value)
    {
        return Guid.TryParseExact(value, "D", out Guid parsed) &&
            string.Equals(
                value,
                parsed.ToString("D").ToLowerInvariant(),
                StringComparison.Ordinal);
    }

    private static bool TryPositiveCanonicalInteger(string? value)
    {
        return long.TryParse(
                value,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out long parsed) &&
            parsed > 0 &&
            string.Equals(
                value,
                parsed.ToString(CultureInfo.InvariantCulture),
                StringComparison.Ordinal);
    }
}
