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
        if (!TrySearchMode(request?.SearchMode, out OriginalDiscoverySearchMode searchMode))
        {
            return EndpointErrors.BadRequest(
                "original_discovery.search_mode_invalid",
                "Search mode must be releaseFirst or deep");
        }

        ExternalOriginalCandidateResult result = await candidateService.FindAsync(
            currentCollection.CollectionId,
            new TrackId(trackId),
            request?.ProviderCodes,
            cancellationToken,
            searchMode);

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

    private static bool TrySearchMode(
        string? value,
        out OriginalDiscoverySearchMode searchMode)
    {
        if (string.IsNullOrWhiteSpace(value) ||
            string.Equals(value, "deep", StringComparison.OrdinalIgnoreCase))
        {
            searchMode = OriginalDiscoverySearchMode.Deep;
            return true;
        }

        if (string.Equals(value, "releaseFirst", StringComparison.OrdinalIgnoreCase))
        {
            searchMode = OriginalDiscoverySearchMode.ReleaseFirst;
            return true;
        }

        searchMode = default;
        return false;
    }

    private static ExternalOriginalCandidateListResponse ToExternalResponse(
        ExternalOriginalCandidateResult result)
    {
        return new ExternalOriginalCandidateListResponse
        {
            Local = ToResponse(result.Local),
            Items =
            [
                .. result.Candidates.Select(ToExternalResponse),
                .. result.DiscogsCandidates.Select(ToDiscogsResponse)
            ],
            ProviderStatuses =
            [
                .. result.ProviderStatuses.Select(ToExternalProviderStatus)
            ],
            Warnings = result.Warnings,
            SearchDiagnostics =
            [
                .. result.SearchDiagnostics.Select(diagnostic =>
                    new ExternalOriginalCandidateSearchDiagnosticResponse
                    {
                        ProviderCode = diagnostic.ProviderCode,
                        RequestUrl = diagnostic.RequestUrl,
                        TotalResults = diagnostic.TotalResults,
                        Offset = diagnostic.Offset,
                        Items =
                        [
                            .. diagnostic.Items.Select(item =>
                                new ExternalOriginalCandidateSearchDiagnosticItemResponse
                                {
                                    ExternalId = item.ExternalId,
                                    Title = item.Title,
                                    Artists = item.Artists,
                                    DurationSeconds = item.Duration?.TotalSeconds,
                                    Score = item.Score
                                })
                        ]
                    })
            ]
        };
    }

    private static ExternalOriginalCandidateProviderStatusResponse
        ToExternalProviderStatus(ExternalProviderOperationStatus status)
    {
        return new ExternalOriginalCandidateProviderStatusResponse
        {
            ProviderCode = status.ProviderCode,
            Outcome = ProviderOutcomeValue(status.Outcome),
            ErrorCode = status.ErrorCode,
            RetryAfter = status.RetryAfter
        };
    }

    private static string ProviderOutcomeValue(
        ExternalProviderOperationOutcome outcome)
    {
        string value = outcome.ToString();
        return char.ToLowerInvariant(value[0]) + value[1..];
    }
}
