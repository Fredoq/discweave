using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private static Task<Dictionary<ImportFingerprint, DuplicateTrackCandidate[]>> LoadFingerprintDuplicateMatchesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<ReleaseImportDraftTrack> tracks,
        CancellationToken cancellationToken)
    {
        _ = context;
        _ = collectionId;
        _ = tracks;
        _ = cancellationToken;

        return Task.FromResult<Dictionary<ImportFingerprint, DuplicateTrackCandidate[]>>([]);
    }
}
