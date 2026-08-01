using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseResolver
{
    private sealed class CandidateState
    {
        public CandidateState(
            ExternalMetadataSource recordingSource,
            IReadOnlyList<RecordingReleaseRoute> routes)
        {
            RecordingSource = recordingSource;
            Routes =
            [
                .. routes.Select(route => new ExternalReleaseRouteCandidate
                {
                    MusicBrainzRoute = route,
                    DiscogsBinding = null,
                    IsPreferred = false,
                    EvidenceCodes = ["musicbrainz.release_route"]
                })
            ];
        }

        public ExternalMetadataSource RecordingSource { get; }
        public List<ExternalReleaseRouteCandidate> Routes { get; }
        public SortedSet<string> Warnings { get; } =
            new(StringComparer.Ordinal);
        public List<DiscogsRouteRetryItem> RetryItems { get; } = [];
        public List<ExternalMetadataError> Failures { get; } = [];
        public bool AnyDiscogsSuccess { get; set; }
        public int AttemptedRouteCount { get; set; }
        public int OutboundRequestCount { get; set; }
        public ExternalMetadataReleaseDetail? CurrentMusicBrainzRelease { get; set; }

        public void AddWarning(string warning)
        {
            _ = Warnings.Add(warning);
        }

        public void AddFailure(ExternalMetadataError error)
        {
            Failures.Add(error);
            AddWarning(WarningCode(error));
        }

        public void AddRetry(
            RecordingReleaseRoute route,
            ExternalMetadataReleaseDetail? release)
        {
            if (release is null ||
                RetryItems.Any(item => RouteKey(item.Route) == RouteKey(route)))
            {
                return;
            }

            RetryItems.Add(new DiscogsRouteRetryItem
            {
                Route = route,
                MusicBrainzRelease = release
            });
        }
    }

    private sealed class RouteWork
    {
        public RouteWork(
            int candidateOrdinal,
            int routeOrdinal,
            RecordingReleaseRoute route)
        {
            CandidateOrdinal = candidateOrdinal;
            RouteOrdinal = routeOrdinal;
            Route = route;
        }

        public int CandidateOrdinal { get; }
        public int RouteOrdinal { get; }
        public RecordingReleaseRoute Route { get; }
    }

    private static string RouteKey(RecordingReleaseRoute route)
    {
        return string.Join(
            '\u001f',
            route.ReleaseSource.ExternalId,
            route.MediumPosition,
            route.MusicBrainzTrackMbid);
    }
}
