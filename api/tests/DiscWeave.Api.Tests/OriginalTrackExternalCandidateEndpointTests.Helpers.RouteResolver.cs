using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    private sealed class MusicBrainzOnlyRouteResolver
        : IExternalReleaseRouteResolver
    {
        public Task<ExternalReleaseRouteBatchResolution> ResolveAsync(
            IReadOnlyList<ExternalReleaseRouteResolutionRequest> candidates,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(Create(
                [
                    .. candidates.Select(candidate =>
                    new ExternalReleaseCandidateRouteResolution
                    {
                        RecordingSource = candidate.RecordingSource,
                        Routes =
                        [
                            .. candidate.MusicBrainzRoutes.Select(route =>
                                new ExternalReleaseRouteCandidate
                                {
                                    MusicBrainzRoute = route,
                                    DiscogsBinding = null,
                                    IsPreferred = false,
                                    EvidenceCodes =
                                        ["musicbrainz.release_route"]
                                })
                        ],
                        DiscogsStatus = Succeeded(),
                        Warnings = [],
                        RetryContext = new DiscogsRouteRetryContext
                        {
                            RecordingSource =
                                candidate.RecordingSource,
                            Items = []
                        },
                        AttemptedDiscogsRouteCount = 0,
                        OutboundRequestCount = 0
                    })
                ]));
        }

        public Task<ExternalReleaseRouteBatchResolution> RetryAsync(
            DiscogsRouteRetryContext retryContext,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(Create([]));
        }

        private static ExternalReleaseRouteBatchResolution Create(
            IReadOnlyList<ExternalReleaseCandidateRouteResolution>
                candidates)
        {
            return new ExternalReleaseRouteBatchResolution
            {
                Candidates = candidates,
                DiscogsStatus = Succeeded(),
                AttemptedDiscogsRouteCount = 0,
                OutboundRequestCount = 0,
                Warnings = []
            };
        }

        private static ExternalProviderOperationStatus Succeeded()
        {
            return new ExternalProviderOperationStatus
            {
                ProviderCode = "discogs",
                Outcome = ExternalProviderOperationOutcome.Succeeded
            };
        }
    }
}
