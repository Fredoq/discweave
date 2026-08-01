using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static ExternalOriginalCandidateResponse ToExternalResponse(
        ExternalOriginalCandidate candidate)
    {
        RankedOriginalCandidate ranked = candidate.Ranked;
        return new ExternalOriginalCandidateResponse
        {
            CandidateKey = candidate.CandidateKey,
            LocalTrackId = candidate.LocalTrackId?.Value,
            RecordingSource = ToExternalResponse(candidate.RecordingSource),
            Title = candidate.Title,
            Artists = candidate.Artists,
            Origins = CandidateOrigins(candidate),
            Confidence = ConfidenceValue(ranked.Confidence),
            Selectable = ranked.Selectable,
            SuggestedRelationTypeCode =
                candidate.SuggestedRelationTypeCode,
            EarliestKnownDate = ranked.CandidateChronology is { } chronology
                ? ToResponse(chronology)
                : null,
            SupportingEvidence =
                [.. ranked.SupportingEvidence.Select(ToResponse)],
            Contradictions =
                [.. ranked.Contradictions.Select(ToResponse)],
            MissingEvidence =
                [.. ranked.MissingEvidence.Select(ToResponse)],
            ReleaseRoutes =
                [.. candidate.ReleaseRoutes.Select(ToExternalResponse)],
            DiscogsStatus =
                ToExternalProviderStatus(candidate.DiscogsStatus),
            DiscogsWarnings = candidate.DiscogsWarnings,
            DiscogsRetryContext =
                ToRetryContextResponse(candidate.DiscogsRetryContext)
        };
    }

    private static ExternalOriginalCandidateReleaseRouteResponse ToExternalResponse(
        ExternalReleaseRouteCandidate candidate)
    {
        RecordingReleaseRoute route = candidate.MusicBrainzRoute;
        return new ExternalOriginalCandidateReleaseRouteResponse
        {
            ReleaseSource = ToExternalResponse(route.ReleaseSource),
            ReleaseGroupSource =
                ToExternalResponse(route.ReleaseGroupSource),
            Title = route.Title,
            Date = route.Date is { } date
                ? new ExternalOriginalCandidatePartialDateResponse
                {
                    Year = date.Year,
                    Month = date.Month,
                    Day = date.Day
                }
                : null,
            MediumPosition = route.MediumPosition,
            MusicBrainzTrackMbid = route.MusicBrainzTrackMbid,
            ReleaseGroupRerecordingContext =
                route.ReleaseGroupRerecordingContext,
            RelatedReleaseSources =
            [
                .. route.RelatedReleaseSources.Select(ToExternalResponse)
            ],
            DiscogsBinding = candidate.DiscogsBinding is { } binding
                ? new DiscogsReleaseRouteBindingResponse
                {
                    ReleaseSource =
                        ToExternalResponse(binding.ReleaseSource),
                    RowOrdinal = binding.RowOrdinal,
                    Position = binding.Position,
                    Fingerprint = binding.Fingerprint
                }
                : null,
            IsPreferred = candidate.IsPreferred,
            EvidenceCodes = candidate.EvidenceCodes
        };
    }

    private static ExternalOriginalCandidateSourceResponse ToExternalResponse(
        ExternalMetadataSource source)
    {
        return new ExternalOriginalCandidateSourceResponse
        {
            ProviderCode = source.ProviderName,
            ResourceType = source.ResourceType,
            ExternalId = source.ExternalId,
            SourceUrl = source.SourceUrl,
            Attribution = source.Attribution
        };
    }

    private static List<string> CandidateOrigins(
        ExternalOriginalCandidate candidate)
    {
        var origins = new List<string>();
        if (candidate.LocalTrackId.HasValue)
        {
            origins.Add("local");
        }

        origins.Add("musicbrainz");
        if (candidate.ReleaseRoutes.Any(route =>
            route.DiscogsBinding is not null))
        {
            origins.Add("discogs");
        }

        return origins;
    }
}
