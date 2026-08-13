using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public interface ILocalOriginalCandidateDataSource
{
    Task<LocalOriginalCandidateSnapshot> LoadAsync(
        CollectionId collectionId,
        TrackId sourceTrackId,
        CancellationToken cancellationToken);
}
