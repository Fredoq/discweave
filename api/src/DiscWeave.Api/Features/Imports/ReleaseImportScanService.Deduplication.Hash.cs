using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private static Task<Dictionary<string, DuplicateTrackCandidate[]>> LoadHashDuplicateMatchesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string[] contentHashes,
        CancellationToken cancellationToken)
    {
        _ = context;
        _ = collectionId;
        _ = contentHashes;
        _ = cancellationToken;

        return Task.FromResult<Dictionary<string, DuplicateTrackCandidate[]>>([]);
    }
}
