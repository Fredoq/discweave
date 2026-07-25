using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.Security;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<IResult> ListExternalOriginalCandidatesAsync(
        Guid trackId,
        ExternalOriginalCandidateRequest? request,
        IExternalOriginalCandidateService candidateService,
        ICurrentCollection currentCollection,
        CancellationToken cancellationToken)
    {
        ExternalOriginalCandidateResult result = await candidateService.FindAsync(
            currentCollection.CollectionId,
            new TrackId(trackId),
            request?.ProviderCodes,
            cancellationToken);

        return result.Local.Status switch
        {
            LocalOriginalCandidateStatus.SourceNotFound =>
                EndpointErrors.NotFound(
                "track.not_found",
                "Track was not found"),
            LocalOriginalCandidateStatus.SourceNotEligible =>
                EndpointErrors.Conflict(
                "original_discovery.source_not_eligible",
                "Track is not eligible for original discovery"),
            LocalOriginalCandidateStatus.Success
                when result.Local.HasReliableCandidate =>
                EndpointErrors.Conflict(
                "original_discovery.local_candidate_available",
                "A reliable local original candidate is available"),
            LocalOriginalCandidateStatus.Success =>
                Results.Ok(ToExternalResponse(result)),
            _ => throw new InvalidOperationException(
                $"Unknown local original candidate status: {result.Local.Status}")
        };
    }

    private static ExternalOriginalCandidateListResponse ToExternalResponse(
        ExternalOriginalCandidateResult result)
    {
        return new ExternalOriginalCandidateListResponse
        {
            Local = ToResponse(result.Local),
            Items =
            [
                .. result.Candidates.Select(ToExternalResponse)
            ],
            ProviderStatuses =
            [
                .. result.ProviderStatuses.Select(status =>
                    new ExternalOriginalCandidateProviderStatusResponse
                    {
                        ProviderCode = status.ProviderCode,
                        Outcome = ProviderOutcomeValue(status.Outcome),
                        ErrorCode = status.ErrorCode,
                        RetryAfter = status.RetryAfter
                    })
            ],
            Warnings = result.Warnings
        };
    }

    private static string ProviderOutcomeValue(
        ExternalProviderOperationOutcome outcome)
    {
        string value = outcome.ToString();
        return char.ToLowerInvariant(value[0]) + value[1..];
    }
}
