using System.Globalization;
using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.Security;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<IResult> ListLocalOriginalCandidatesAsync(
        Guid trackId,
        ILocalOriginalCandidateService candidateService,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        LocalOriginalCandidateResult result = await candidateService.FindAsync(
            currentCollection.CollectionId,
            new TrackId(trackId),
            cancellationToken);

        return result.Status switch
        {
            LocalOriginalCandidateStatus.SourceNotFound =>
                EndpointErrors.NotFound(
                    "track.not_found",
                    "Track was not found"),
            LocalOriginalCandidateStatus.SourceNotEligible =>
                EndpointErrors.Conflict(
                    "original_discovery.source_not_eligible",
                    "Track is not eligible for original discovery"),
            LocalOriginalCandidateStatus.Success =>
                Results.Ok(ToResponse(result)),
            _ => throw new InvalidOperationException(
                $"Unknown local original candidate status: {result.Status}")
        };
    }

    private static LocalOriginalCandidateListResponse ToResponse(
        LocalOriginalCandidateResult result)
    {
        return new LocalOriginalCandidateListResponse
        {
            SourceTrackId = result.SourceTrackId.Value,
            HasReliableLocalCandidate = result.HasReliableCandidate,
            Items = [.. result.Candidates.Select(ToResponse)]
        };
    }

    private static LocalOriginalCandidateResponse ToResponse(
        LocalOriginalCandidate candidate)
    {
        RankedOriginalCandidate ranked = candidate.Ranked;
        return new LocalOriginalCandidateResponse
        {
            CandidateKey = candidate.CandidateKey,
            LocalTrackId = candidate.LocalTrackId.Value,
            Title = candidate.Title,
            ArtistDisplay = candidate.ArtistDisplay,
            DurationSeconds = candidate.Duration is { } duration
                ? (int)duration.TotalSeconds
                : null,
            VersionYear = candidate.VersionYear,
            Origins = ["local"],
            Confidence = ConfidenceValue(ranked.Confidence),
            Selectable = ranked.Selectable,
            IsExistingRoot = candidate.IsExistingRoot,
            MemberCount = candidate.MemberCount,
            RequiresPromotion = candidate.RequiresPromotion,
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
                [.. ranked.MissingEvidence.Select(ToResponse)]
        };
    }

    private static OriginalCandidateEvidenceResponse ToResponse(
        OriginalCandidateEvidence evidence)
    {
        return new OriginalCandidateEvidenceResponse
        {
            Code = EvidenceCodeValue(evidence.Code),
            Channel = EvidenceChannelValue(evidence.Channel)
        };
    }

    private static OriginalCandidateDateResponse ToResponse(
        OriginalCandidateChronology chronology)
    {
        return new OriginalCandidateDateResponse
        {
            Value = chronology.Precision switch
            {
                OriginalCandidateDatePrecision.Year =>
                    chronology.LowerBound.ToString(
                        "yyyy",
                        CultureInfo.InvariantCulture),
                OriginalCandidateDatePrecision.Month =>
                    chronology.LowerBound.ToString(
                        "yyyy-MM",
                        CultureInfo.InvariantCulture),
                OriginalCandidateDatePrecision.Day =>
                    chronology.LowerBound.ToString(
                        "yyyy-MM-dd",
                        CultureInfo.InvariantCulture),
                _ => throw new InvalidOperationException(
                    $"Unknown date precision: {chronology.Precision}")
            },
            Precision = chronology.Precision switch
            {
                OriginalCandidateDatePrecision.Year => "year",
                OriginalCandidateDatePrecision.Month => "month",
                OriginalCandidateDatePrecision.Day => "day",
                _ => throw new InvalidOperationException(
                    $"Unknown date precision: {chronology.Precision}")
            },
            Complete = chronology.Complete
        };
    }

    private static string ConfidenceValue(
        OriginalCandidateConfidence confidence)
    {
        return confidence switch
        {
            OriginalCandidateConfidence.High => "high",
            OriginalCandidateConfidence.Medium => "medium",
            OriginalCandidateConfidence.Low => "low",
            _ => throw new InvalidOperationException(
                $"Unknown candidate confidence: {confidence}")
        };
    }

    private static string EvidenceChannelValue(
        OriginalCandidateEvidenceChannel channel)
    {
        return channel switch
        {
            OriginalCandidateEvidenceChannel.LocalCatalog => "localCatalog",
            OriginalCandidateEvidenceChannel.MusicBrainz => "musicBrainz",
            OriginalCandidateEvidenceChannel.Discogs => "discogs",
            _ => throw new InvalidOperationException(
                $"Unknown evidence channel: {channel}")
        };
    }

    private static string EvidenceCodeValue(
        OriginalCandidateEvidenceCode code)
    {
        string value = code.ToString();
        return char.ToLowerInvariant(value[0]) + value[1..];
    }
}
