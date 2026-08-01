using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Features.Tracks;

public sealed partial class ExternalOriginalCandidateService
{
    private async Task<ExternalOriginalCandidate[]>
        EnrichDiscogsRoutesAsync(
            ExternalOriginalCandidate[] prepared,
            List<ExternalProviderOperationStatus> statuses,
            SortedSet<string> warnings,
            CancellationToken cancellationToken)
    {
        if (!prepared.Any(candidate =>
            candidate.ReleaseRoutes.Count > 0))
        {
            return prepared;
        }

        ExternalReleaseRouteBatchResolution routeResolution =
            await _routeResolver.ResolveAsync(
                [
                    .. prepared.Select(candidate =>
                        new ExternalReleaseRouteResolutionRequest
                        {
                            RecordingSource =
                                candidate.RecordingSource,
                            MusicBrainzRoutes =
                            [
                                .. candidate.ReleaseRoutes.Select(route =>
                                    route.MusicBrainzRoute)
                            ]
                        })
                ],
                cancellationToken);
        _ = statuses.RemoveAll(status =>
            string.Equals(
                status.ProviderCode,
                "discogs",
                StringComparison.Ordinal));
        statuses.Add(routeResolution.DiscogsStatus);
        warnings.UnionWith(routeResolution.Warnings);
        var resolutionByRecording =
            routeResolution.Candidates.ToDictionary(
                candidate =>
                    candidate.RecordingSource.ExternalId,
                StringComparer.Ordinal);
        return
        [
            .. prepared.Select(candidate =>
                resolutionByRecording.TryGetValue(
                    candidate.RecordingSource.ExternalId,
                    out ExternalReleaseCandidateRouteResolution? resolved)
                    ? candidate with
                    {
                        ReleaseRoutes = resolved.Routes,
                        DiscogsStatus = resolved.DiscogsStatus,
                        DiscogsWarnings = resolved.Warnings,
                        DiscogsRetryContext =
                            resolved.RetryContext
                    }
                    : candidate)
        ];
    }
}
