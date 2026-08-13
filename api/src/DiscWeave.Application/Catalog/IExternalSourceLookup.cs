using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog;

public interface IExternalSourceLookup
{
    Task<IReadOnlyList<Release>> FindReleasesAsync(
        CollectionId collectionId,
        IReadOnlyCollection<ExternalSourceLookupIdentity> identities,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Track>> FindTracksAsync(
        CollectionId collectionId,
        IReadOnlyCollection<ExternalSourceLookupIdentity> identities,
        CancellationToken cancellationToken);
}
