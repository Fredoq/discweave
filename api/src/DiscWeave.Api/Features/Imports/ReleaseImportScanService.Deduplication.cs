using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private static Task ApplyDuplicateTrackMatchesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        CancellationToken cancellationToken)
    {
        _ = context;
        _ = collectionId;
        _ = sessionId;
        _ = cancellationToken;

        return Task.CompletedTask;
    }
}
