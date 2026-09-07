using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static ExternalOriginalCandidateResponse ToDiscogsResponse(DiscogsOriginalCandidate candidate)
    {
        ExternalMetadataReleaseDetail release = candidate.Release;
        ExternalMetadataReleaseTrack track = release.Tracklist[candidate.RowOrdinal];
        ExternalOriginalCandidateSourceResponse source = ToExternalResponse(release.Source);
        return new ExternalOriginalCandidateResponse
        {
            CandidateKey = $"discogs:{release.Source.ExternalId}:{candidate.RowOrdinal}:{candidate.Fingerprint}",
            RecordingSource = null,
            Title = track.Title,
            Artists = track.Artists.Count > 0 ? track.Artists : release.Artists,
            Origins = ["discogs"],
            Confidence = "medium",
            Selectable = true,
            InferenceComplete = false,
            CandidateRole = "historicalRoot",
            DiscoveryPaths = ["discogsReleaseSearch"],
            SuggestedRelationTypeCode = candidate.SuggestedRelationTypeCode,
            SupportingEvidence = [],
            Contradictions = [],
            MissingEvidence = [],
            DiscogsStatus = new ExternalOriginalCandidateProviderStatusResponse { ProviderCode = "discogs", Outcome = "succeeded" },
            DiscogsWarnings = [],
            DiscogsRetryContext = null,
            ReleaseRoutes = [new ExternalOriginalCandidateReleaseRouteResponse
            {
                ReleaseSource = source,
                ReleaseGroupSource = null,
                Title = release.Title,
                Date = release.Year is { } year ? new ExternalOriginalCandidatePartialDateResponse
                {
                    Year = year, Month = release.ReleaseDate?.Month, Day = release.ReleaseDate?.Day
                } : null,
                MediumPosition = track.Disc ?? "",
                MusicBrainzTrackMbid = null,
                ReleaseGroupRerecordingContext = false,
                RelatedReleaseSources = [],
                Artists = release.Artists,
                Labels = release.Labels,
                Formats = release.Formats,
                CatalogNumber = release.CatalogNumber,
                TrackTitle = track.Title,
                TrackPosition = track.Position,
                TrackDurationSeconds = track.Duration?.TotalSeconds,
                DiscogsBinding = new DiscogsReleaseRouteBindingResponse
                {
                    ReleaseSource = source,
                    RowOrdinal = candidate.RowOrdinal,
                    Position = track.Position ?? throw new InvalidOperationException("Discogs candidate track position is required"),
                    Fingerprint = candidate.Fingerprint
                },
                IsPreferred = false,
                EvidenceCodes = []
            }]
        };
    }
}
