using DiscWeave.Api.Http;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.Security;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.Options;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<IResult> RetryDiscogsOriginalRoutesAsync(
        Guid trackId,
        DiscogsOriginalRouteRetryRequest? request,
        ILocalOriginalCandidateService localService,
        IExternalReleaseRouteResolver routeResolver,
        ICurrentCollection currentCollection,
        IOptions<DiscogsOptions> options,
        CancellationToken cancellationToken)
    {
        LocalOriginalCandidateResult local = await localService.FindAsync(
            currentCollection.CollectionId,
            new TrackId(trackId),
            cancellationToken);
        IResult? localError = LocalDiscoveryError(local);
        if (localError is not null)
        {
            return localError;
        }

        if (!TryMapRetryContext(request, out DiscogsRouteRetryContext context) ||
            context.Items.Count > options.Value.MaxOriginalRouteLookups)
        {
            return EndpointErrors.BadRequest(
                "original_discovery.discogs_retry_invalid",
                "Discogs route retry request is invalid");
        }

        ExternalReleaseRouteBatchResolution result =
            await routeResolver.RetryAsync(context, cancellationToken);
        ExternalReleaseCandidateRouteResolution candidate =
            result.Candidates.SingleOrDefault(value =>
                string.Equals(
                    value.RecordingSource.ProviderName,
                    context.RecordingSource.ProviderName,
                    StringComparison.Ordinal) &&
                string.Equals(
                    value.RecordingSource.ResourceType,
                    context.RecordingSource.ResourceType,
                    StringComparison.Ordinal) &&
                string.Equals(
                    value.RecordingSource.ExternalId,
                    context.RecordingSource.ExternalId,
                    StringComparison.Ordinal))
            ?? throw new InvalidOperationException(
                "Discogs retry result must contain the requested Recording candidate");

        return Results.Ok(new DiscogsOriginalRouteRetryResponse
        {
            Routes =
                [.. candidate.Routes.Select(ToExternalResponse)],
            DiscogsStatus =
                ToExternalProviderStatus(candidate.DiscogsStatus),
            DiscogsWarnings = candidate.Warnings,
            DiscogsRetryContext =
                ToRetryContextResponse(candidate.RetryContext),
            AttemptedDiscogsRouteCount =
                candidate.AttemptedDiscogsRouteCount,
            OutboundRequestCount = candidate.OutboundRequestCount
        });
    }

    private static IResult? LocalDiscoveryError(
        LocalOriginalCandidateResult result)
    {
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
            LocalOriginalCandidateStatus.Success
                when result.HasReliableCandidate =>
                EndpointErrors.Conflict(
                    "original_discovery.local_candidate_available",
                    "A reliable local original candidate is available"),
            LocalOriginalCandidateStatus.Success => null,
            _ => throw new InvalidOperationException(
                $"Unknown local original candidate status: {result.Status}")
        };
    }
}
