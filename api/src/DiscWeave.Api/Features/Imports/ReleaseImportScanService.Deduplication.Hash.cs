using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private static async Task<Dictionary<string, DuplicateTrackCandidate[]>> LoadHashDuplicateMatchesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string[] contentHashes,
        CancellationToken cancellationToken)
    {
        if (contentHashes.Length == 0)
        {
            return [];
        }

        DuplicateHashMatch[] rows = await context.OwnedItems
            .Where(item =>
                item.CollectionId == collectionId &&
                EF.Property<string?>(item, "_importIdentityContentHash") != null &&
                contentHashes.Contains(EF.Property<string>(item, "_importIdentityContentHash")))
            .Select(item => new DuplicateHashMatch(
                EF.Property<string>(item, "_importIdentityContentHash"),
                EF.Property<ReleaseId>(item, "_releaseId")))
            .ToArrayAsync(cancellationToken);
        Dictionary<ReleaseId, DuplicateTrackCandidate[]> candidatesByReleaseId = await LoadReleaseTrackCandidatesAsync(
            context,
            collectionId,
            [.. rows.Select(row => row.ReleaseId).Distinct()],
            cancellationToken);
        var matches = new Dictionary<string, List<DuplicateTrackCandidate>>(StringComparer.Ordinal);
        foreach (DuplicateHashMatch row in rows)
        {
            if (!candidatesByReleaseId.TryGetValue(row.ReleaseId, out DuplicateTrackCandidate[]? candidates))
            {
                continue;
            }

            if (!matches.TryGetValue(row.ContentHash, out List<DuplicateTrackCandidate>? existing))
            {
                existing = [];
                matches[row.ContentHash] = existing;
            }

            existing.AddRange(candidates);
        }

        return matches.ToDictionary(
            pair => pair.Key,
            pair => DistinctCandidates(pair.Value),
            StringComparer.Ordinal);
    }

    private sealed record DuplicateHashMatch(string ContentHash, ReleaseId ReleaseId);
}
