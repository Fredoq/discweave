using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private const string MusicBrainzProviderCode = "musicbrainz";
    private const string DiscogsProviderCode = "discogs";

    private static bool TryMapRetryContext(
        DiscogsOriginalRouteRetryRequest? request,
        out DiscogsRouteRetryContext context)
    {
        context = null!; // NOSONAR: the value is consumed only when this method returns true.
        if (request?.RetryContext is not { } data ||
            data.Items is null ||
            !TryMapSource(
                data.RecordingSource,
                MusicBrainzProviderCode,
                "recording",
                out ExternalMetadataSource recordingSource))
        {
            return false;
        }

        var items = new List<DiscogsRouteRetryItem>(data.Items.Count);
        foreach (DiscogsOriginalRouteRetryRequest.ItemData item in data.Items)
        {
            if (item is null ||
                !TryMapRoute(item.Route, out RecordingReleaseRoute route) ||
                !TryMapRelease(
                    item.MusicBrainzRelease,
                    out ExternalMetadataReleaseDetail release) ||
                release.Source != route.ReleaseSource)
            {
                return false;
            }

            items.Add(new DiscogsRouteRetryItem
            {
                Route = route,
                MusicBrainzRelease = release
            });
        }

        context = new DiscogsRouteRetryContext
        {
            RecordingSource = recordingSource,
            Items = items
        };
        return true;
    }

    private static bool TryMapRoute(
        DiscogsOriginalRouteRetryRequest.RouteData? data,
        out RecordingReleaseRoute route)
    {
        route = null!; // NOSONAR: the value is consumed only when this method returns true.
        if (data is null ||
            data.RelatedReleaseSources is null ||
            string.IsNullOrWhiteSpace(data.Title) ||
            !TryMapSource(
                data.ReleaseSource,
                MusicBrainzProviderCode,
                "release",
                out ExternalMetadataSource releaseSource) ||
            !TryMapSource(
                data.ReleaseGroupSource,
                MusicBrainzProviderCode,
                "release-group",
                out ExternalMetadataSource releaseGroupSource) ||
            !IsCanonicalMbid(data.MusicBrainzTrackMbid) ||
            !TryPositiveCanonicalInteger(data.MediumPosition) ||
            !TryMapProviderDate(data.Date, out ProviderPartialDate? date) ||
            !TryMapSources(
                data.RelatedReleaseSources,
                DiscogsProviderCode,
                "release",
                out ExternalMetadataSource[] relatedSources))
        {
            return false;
        }

        route = new RecordingReleaseRoute
        {
            ReleaseSource = releaseSource,
            ReleaseGroupSource = releaseGroupSource,
            Title = data.Title,
            Date = date,
            MediumPosition = data.MediumPosition,
            MusicBrainzTrackMbid = data.MusicBrainzTrackMbid,
            ReleaseGroupRerecordingContext =
                data.ReleaseGroupRerecordingContext,
            RelatedReleaseSources = relatedSources
        };
        return true;
    }

    private static bool TryMapRelease(
        DiscogsOriginalRouteRetryRequest.ReleaseData? data,
        out ExternalMetadataReleaseDetail release)
    {
        release = null!; // NOSONAR: the value is consumed only when this method returns true.
        if (data is null ||
            data.Artists is null ||
            data.Labels is null ||
            data.Tracklist is null ||
            data.Identifiers is null ||
            data.Identifiers.Any(identifier =>
                identifier is null ||
                string.IsNullOrWhiteSpace(identifier.Type) ||
                string.IsNullOrWhiteSpace(identifier.Value)) ||
            data.RelatedSources is null ||
            string.IsNullOrWhiteSpace(data.Title) ||
            !TryMapSource(
                data.Source,
                MusicBrainzProviderCode,
                "release",
                out ExternalMetadataSource source) ||
            !TryMapEvidence(
                data.ReleaseDateEvidence,
                out IOptionalValue<ExternalMetadataPartialDate> evidence) ||
            !TryMapSources(
                data.RelatedSources,
                DiscogsProviderCode,
                "release",
                out ExternalMetadataSource[] relatedSources) ||
            !TryMapTracks(
                data.Tracklist,
                out ExternalMetadataReleaseTrack[] tracks))
        {
            return false;
        }

        release = new ExternalMetadataReleaseDetail(
            source,
            data.Title,
            data.Artists,
            null,
            null,
            data.Labels,
            [],
            null,
            [],
            tracks,
            [.. data.Identifiers.Select(value =>
                new ExternalMetadataIdentifier(value.Type, value.Value))],
            data.CatalogNumber,
            [],
            [],
            relatedSources: relatedSources,
            releaseDateEvidence: evidence,
            tracklistComplete: data.TracklistComplete);
        return true;
    }

    private static bool TryMapTracks(
        IReadOnlyList<DiscogsOriginalRouteRetryRequest.TrackData> data,
        out ExternalMetadataReleaseTrack[] tracks)
    {
        var mapped = new List<ExternalMetadataReleaseTrack>(data.Count);
        foreach (DiscogsOriginalRouteRetryRequest.TrackData track in data)
        {
            if (track is null ||
                track.Artists is null ||
                track.ExternalSources is null ||
                string.IsNullOrWhiteSpace(track.Title) ||
                !TryMapMusicBrainzRowSources(
                    track.ExternalSources,
                    out ExternalMetadataSource[] sources) ||
                !TryMapDuration(
                    track.DurationMilliseconds,
                    out TimeSpan? duration))
            {
                tracks = [];
                return false;
            }

            mapped.Add(new ExternalMetadataReleaseTrack(
                track.Title,
                track.Position,
                duration,
                track.Artists,
                track.Disc,
                track.Side,
                externalSources: sources));
        }

        tracks = [.. mapped];
        return true;
    }

    private static bool TryMapMusicBrainzRowSources(
        IReadOnlyList<ExternalOriginalCandidateSourceResponse> data,
        out ExternalMetadataSource[] sources)
    {
        sources = [];
        if (data.Count != 2)
        {
            return false;
        }

        var mapped = new List<ExternalMetadataSource>(2);
        foreach (ExternalOriginalCandidateSourceResponse source in data)
        {
            string? resourceType = source?.ResourceType;
            if (resourceType is not ("track" or "recording") ||
                !TryMapSource(
                    source,
                    MusicBrainzProviderCode,
                    resourceType,
                    out ExternalMetadataSource value))
            {
                return false;
            }

            mapped.Add(value);
        }

        if (mapped.Select(source => source.ResourceType)
            .Distinct(StringComparer.Ordinal).Count() != 2)
        {
            return false;
        }

        sources = [.. mapped];
        return true;
    }

}
