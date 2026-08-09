using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Tracks;

public sealed partial class ExternalOriginalCandidateService
{
    private static IReadOnlyList<RecordingReleaseRoute> MergeRoutes(
        IEnumerable<RecordingReleaseRoute> routes)
    {
        return
        [
            .. routes
                .GroupBy(RouteKey, StringComparer.Ordinal)
                .SelectMany(MergeLocatorRoutes)
                .OrderBy(RouteFactKey, StringComparer.Ordinal)
        ];
    }

    private static IEnumerable<RecordingReleaseRoute> MergeLocatorRoutes(
        IEnumerable<RecordingReleaseRoute> routes)
    {
        RecordingReleaseRoute[] orderedRoutes =
        [
            .. routes.OrderBy(RouteFactKey, StringComparer.Ordinal)
        ];
        if (orderedRoutes.Length == 1)
        {
            return orderedRoutes;
        }

        var merged = new List<RecordingReleaseRoute>();
        foreach (RecordingReleaseRoute route in orderedRoutes)
        {
            RecordingReleaseRoute normalized = route with
            {
                RelatedReleaseSources = MergeRelatedSources(
                    route.RelatedReleaseSources,
                    [])
            };
            int compatibleIndex = merged.FindIndex(existing =>
                RoutesAreCompatible(existing, normalized));
            if (compatibleIndex < 0)
            {
                merged.Add(normalized);
                continue;
            }

            merged[compatibleIndex] = MergeRoute(
                merged[compatibleIndex],
                normalized);
        }

        return merged.OrderBy(RouteFactKey, StringComparer.Ordinal);
    }

    private static bool RoutesAreCompatible(
        RecordingReleaseRoute first,
        RecordingReleaseRoute second)
    {
        return SourcesAreCompatible(
                first.ReleaseSource,
                second.ReleaseSource)
            && SourcesAreCompatible(
                first.ReleaseGroupSource,
                second.ReleaseGroupSource)
            && FactsAreCompatible(
                first.Title,
                second.Title,
                StringComparer.Ordinal)
            && DatesAreCompatible(first.Date, second.Date);
    }

    private static bool SourcesAreCompatible(
        ExternalMetadataSource first,
        ExternalMetadataSource second)
    {
        return FactsAreCompatible(
                first.ProviderName,
                second.ProviderName,
                StringComparer.OrdinalIgnoreCase)
            && FactsAreCompatible(
                first.ResourceType,
                second.ResourceType,
                StringComparer.OrdinalIgnoreCase)
            && FactsAreCompatible(
                first.ExternalId,
                second.ExternalId,
                StringComparer.OrdinalIgnoreCase)
            && FactsAreCompatible(
                first.SourceUrl,
                second.SourceUrl,
                StringComparer.Ordinal)
            && FactsAreCompatible(
                first.Attribution,
                second.Attribution,
                StringComparer.Ordinal);
    }

    private static bool FactsAreCompatible(
        string first,
        string second,
        StringComparer comparer)
    {
        return string.IsNullOrWhiteSpace(first)
            || string.IsNullOrWhiteSpace(second)
            || comparer.Equals(first, second);
    }

    private static bool DatesAreCompatible(
        ProviderPartialDate? first,
        ProviderPartialDate? second)
    {
        return first is null // NOSONAR: route date merge preserves the first complete chronology.
            || second is null
            || (first.Year == second.Year
                && NullableFactsAreCompatible(
                    first.Month,
                    second.Month)
                && NullableFactsAreCompatible(
                    first.Day,
                    second.Day));
    }

    private static bool NullableFactsAreCompatible(
        int? first,
        int? second)
    {
        return first is null || second is null || first == second;
    }

    private static RecordingReleaseRoute MergeRoute(
        RecordingReleaseRoute first,
        RecordingReleaseRoute second)
    {
        return first with
        {
            ReleaseSource = MergeSource(
                first.ReleaseSource,
                second.ReleaseSource),
            ReleaseGroupSource = MergeSource(
                first.ReleaseGroupSource,
                second.ReleaseGroupSource),
            Title = MergeFact(first.Title, second.Title),
            Date = MergeDate(first.Date, second.Date),
            MediumPosition = MergeFact(
                first.MediumPosition,
                second.MediumPosition),
            MusicBrainzTrackMbid = MergeFact(
                first.MusicBrainzTrackMbid,
                second.MusicBrainzTrackMbid),
            ReleaseGroupRerecordingContext =
                first.ReleaseGroupRerecordingContext
                || second.ReleaseGroupRerecordingContext,
            RelatedReleaseSources = MergeRelatedSources(
                first.RelatedReleaseSources,
                second.RelatedReleaseSources)
        };
    }

    private static ExternalMetadataSource MergeSource(
        ExternalMetadataSource first,
        ExternalMetadataSource second)
    {
        return new ExternalMetadataSource(
            MergeFact(first.ProviderName, second.ProviderName),
            MergeFact(first.ResourceType, second.ResourceType),
            MergeFact(first.ExternalId, second.ExternalId),
            MergeFact(first.SourceUrl, second.SourceUrl),
            MergeFact(first.Attribution, second.Attribution));
    }

    private static ProviderPartialDate? MergeDate(
        ProviderPartialDate? first,
        ProviderPartialDate? second)
    {
        return first is null // NOSONAR: route date merge preserves the first complete chronology.
            ? second
            : second is null
            ? first
            : new ProviderPartialDate
            {
                Year = first.Year,
                Month = first.Month ?? second.Month,
                Day = first.Day ?? second.Day
            };
    }

    private static IReadOnlyList<ExternalMetadataSource> MergeRelatedSources(
        IEnumerable<ExternalMetadataSource> first,
        IEnumerable<ExternalMetadataSource> second)
    {
        return
        [
            .. first
                .Concat(second)
                .Distinct()
                .OrderBy(SourceFactKey, StringComparer.Ordinal)
        ];
    }

    private static string MergeFact(string first, string second)
    {
        return string.IsNullOrWhiteSpace(first)
            ? second
            : string.IsNullOrWhiteSpace(second) || string.CompareOrdinal(first, second) <= 0 // NOSONAR: deterministic provider fact merge keeps the shortest expression local.
                ? first
                : second;
    }

    private static string RouteFactKey(RecordingReleaseRoute route)
    {
        return string.Join(
            '\u001f',
            route.Title,
            DateFactKey(route.Date),
            SourceFactKey(route.ReleaseGroupSource),
            SourceFactKey(route.ReleaseSource),
            route.MediumPosition,
            route.MusicBrainzTrackMbid.ToLowerInvariant());
    }

    private static string DateFactKey(ProviderPartialDate? date)
    {
        return date is null
            ? string.Empty
            : string.Join(
                '-',
                date.Year.ToString("D4", CultureInfo.InvariantCulture),
                date.Month?.ToString(
                    "D2",
                    CultureInfo.InvariantCulture) ?? string.Empty,
                date.Day?.ToString(
                    "D2",
                    CultureInfo.InvariantCulture) ?? string.Empty);
    }

    private static string SourceFactKey(ExternalMetadataSource source)
    {
        return string.Join(
            '\u001f',
            source.ProviderName.ToLowerInvariant(),
            source.ResourceType.ToLowerInvariant(),
            source.ExternalId.ToLowerInvariant(),
            source.SourceUrl,
            source.Attribution);
    }
}
