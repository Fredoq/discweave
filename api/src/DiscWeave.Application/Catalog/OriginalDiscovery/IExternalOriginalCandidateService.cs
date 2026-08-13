using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public interface IExternalOriginalCandidateService
{
    Task<ExternalOriginalCandidateResult> FindAsync(
        CollectionId collectionId,
        TrackId sourceTrackId,
        IReadOnlyCollection<string>? providerCodes,
        CancellationToken cancellationToken,
        OriginalDiscoverySearchMode searchMode = OriginalDiscoverySearchMode.Deep);
}
