using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseResolver
{
    private static bool HasDirectHint(RecordingReleaseRoute route)
    {
        return route.RelatedReleaseSources.Any(IsCanonicalDiscogsRelease);
    }

    private static ExternalMetadataSource? AuthoritativeDirectSource(
        RecordingReleaseRoute route,
        ExternalMetadataReleaseDetail release)
    {
        _ = route;
        return release.RelatedSources
            .Where(IsCanonicalDiscogsRelease)
            .OrderBy(source =>
                long.Parse(
                    source.ExternalId,
                    CultureInfo.InvariantCulture))
            .FirstOrDefault();
    }

    private static bool IsActionableRoute(
        ExternalMetadataSource recordingSource,
        RecordingReleaseRoute route)
    {
        return IsCanonicalMusicBrainzSource(
                recordingSource,
                "recording") &&
            IsCanonicalMusicBrainzSource(
                route.ReleaseSource,
                "release") &&
            IsCanonicalMusicBrainzSource(
                route.ReleaseGroupSource,
                "release-group") &&
            IsCanonicalMbid(route.MusicBrainzTrackMbid) &&
            int.TryParse(
                route.MediumPosition,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out int medium) &&
            medium > 0 &&
            string.Equals(
                route.MediumPosition,
                medium.ToString(CultureInfo.InvariantCulture),
                StringComparison.Ordinal);
    }

    private static bool IsCanonicalMusicBrainzSource(
        ExternalMetadataSource source,
        string resourceType)
    {
        return IsCanonicalMbid(source.ExternalId) &&
            string.Equals(
                source.ProviderName,
                "musicbrainz",
                StringComparison.Ordinal) &&
            string.Equals(
                source.ResourceType,
                resourceType,
                StringComparison.Ordinal) &&
            string.Equals(
                source.SourceUrl,
                $"https://musicbrainz.org/{resourceType}/{source.ExternalId}",
                StringComparison.Ordinal);
    }

    private static bool IsCanonicalMbid(string value)
    {
        return Guid.TryParseExact(value, "D", out Guid parsed) &&
            string.Equals(
                value,
                parsed.ToString("D").ToLowerInvariant(),
                StringComparison.Ordinal);
    }

    private static bool IsCanonicalDiscogsRelease(
        ExternalMetadataSource source)
    {
        return string.Equals(
                source.ProviderName,
                "discogs",
                StringComparison.Ordinal) &&
            string.Equals(
                source.ResourceType,
                "release",
                StringComparison.Ordinal) &&
            long.TryParse(
                source.ExternalId,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out long id) &&
            id > 0 &&
            string.Equals(
                source.SourceUrl,
                $"https://www.discogs.com/release/{source.ExternalId}",
                StringComparison.Ordinal);
    }

    private void ValidateRetryContext(DiscogsRouteRetryContext retryContext)
    {
        if (!IsCanonicalMusicBrainzSource(
                retryContext.RecordingSource,
                "recording") ||
            retryContext.Items.Count > _options.MaxOriginalRouteLookups ||
            retryContext.Items.Any(item =>
                !IsActionableRoute(
                    retryContext.RecordingSource,
                    item.Route) ||
                item.MusicBrainzRelease.Source !=
                    item.Route.ReleaseSource))
        {
            throw new ArgumentException(
                "Discogs route retry context is invalid",
                nameof(retryContext));
        }
    }

    private static bool IsDiscoveryExhausted(
        ExternalMetadataError error)
    {
        return string.Equals(
            error.Code,
            "discogs.request_budget_exhausted",
            StringComparison.Ordinal);
    }
}
