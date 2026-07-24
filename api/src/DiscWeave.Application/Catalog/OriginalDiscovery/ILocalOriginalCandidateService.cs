using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public interface ILocalOriginalCandidateService
{
    Task<LocalOriginalCandidateResult> FindAsync(
        CollectionId collectionId,
        TrackId sourceTrackId,
        CancellationToken cancellationToken);
}
