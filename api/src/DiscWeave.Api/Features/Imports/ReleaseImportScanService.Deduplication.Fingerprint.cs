using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private static async Task<Dictionary<ImportFingerprint, DuplicateTrackCandidate[]>> LoadFingerprintDuplicateMatchesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<ReleaseImportDraftTrack> tracks,
        CancellationToken cancellationToken)
    {
        string[] paths = [.. tracks.Select(track => track.FilePath).Distinct(StringComparer.Ordinal)];
        if (paths.Length == 0)
        {
            return [];
        }

        DuplicateFingerprintMatch[] rows = await context.OwnedItems
            .Where(item =>
                item.CollectionId == collectionId &&
                EF.Property<string?>(item, "_importIdentityPath") != null &&
                paths.Contains(EF.Property<string>(item, "_importIdentityPath")))
            .Select(item => new DuplicateFingerprintMatch(
                EF.Property<string?>(item, "_importIdentityPath"),
                EF.Property<long?>(item, "_importIdentitySizeBytes"),
                EF.Property<DateTimeOffset?>(item, "_importIdentityLastModifiedAt"),
                EF.Property<ReleaseId>(item, "_releaseId")))
            .ToArrayAsync(cancellationToken);
        Dictionary<ReleaseId, DuplicateTrackCandidate[]> candidatesByReleaseId = await LoadReleaseTrackCandidatesAsync(
            context,
            collectionId,
            [.. rows.Select(row => row.ReleaseId).Distinct()],
            cancellationToken);
        var matches = new Dictionary<ImportFingerprint, List<DuplicateTrackCandidate>>();
        foreach (DuplicateFingerprintMatch row in rows)
        {
            if (row.Path is null ||
                row.SizeBytes is null ||
                row.LastModifiedAt is null ||
                !candidatesByReleaseId.TryGetValue(row.ReleaseId, out DuplicateTrackCandidate[]? candidates))
            {
                continue;
            }

            var fingerprint = new ImportFingerprint(row.Path, row.SizeBytes.Value, row.LastModifiedAt.Value);
            if (!matches.TryGetValue(fingerprint, out List<DuplicateTrackCandidate>? existing))
            {
                existing = [];
                matches[fingerprint] = existing;
            }

            existing.AddRange(candidates);
        }

        return matches.ToDictionary(pair => pair.Key, pair => DistinctCandidates(pair.Value));
    }

    private sealed record DuplicateFingerprintMatch(string? Path, long? SizeBytes, DateTimeOffset? LastModifiedAt, ReleaseId ReleaseId);
}
