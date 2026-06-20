using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
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

        IOptionalValue<string>[] searchedHashes = [.. contentHashes.Select(Optional.From)];
        LocalAudioFile[] matchingFiles = await context.LocalAudioFiles.AsNoTracking()
            .Where(file => file.CollectionId == collectionId && searchedHashes.Contains(file.ContentHash))
            .ToArrayAsync(cancellationToken);
        if (matchingFiles.Length == 0)
        {
            return [];
        }

        LocalAudioFileId[] matchingFileIds = [.. matchingFiles.Select(file => file.Id)];
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && matchingFileIds.Contains(link.LocalAudioFileId))
            .ToArrayAsync(cancellationToken);
        Dictionary<LocalAudioFileId, string> contentHashByLocalFileId = matchingFiles.ToDictionary(
            file => file.Id,
            file => ((PresentOptionalValue<string>)file.ContentHash).Value);
        DuplicateHashMatch[] rows =
        [
            .. links
                .Where(link => contentHashByLocalFileId.ContainsKey(link.LocalAudioFileId))
                .Select(link => new DuplicateHashMatch(
                    contentHashByLocalFileId[link.LocalAudioFileId],
                    link.ReleaseTrackId))
        ];

        Dictionary<ReleaseTrackId, DuplicateTrackCandidate> candidatesByReleaseTrackId = await LoadReleaseTrackCandidatesAsync(
            context,
            collectionId,
            [.. rows.Select(row => row.ReleaseTrackId).Distinct()],
            cancellationToken);
        var matches = new Dictionary<string, List<DuplicateTrackCandidate>>(StringComparer.Ordinal);
        foreach (DuplicateHashMatch row in rows)
        {
            if (!candidatesByReleaseTrackId.TryGetValue(row.ReleaseTrackId, out DuplicateTrackCandidate? candidate))
            {
                continue;
            }

            if (!matches.TryGetValue(row.ContentHash, out List<DuplicateTrackCandidate>? existing))
            {
                existing = [];
                matches[row.ContentHash] = existing;
            }

            existing.Add(candidate);
        }

        return matches.ToDictionary(
            pair => pair.Key,
            pair => DistinctCandidates(pair.Value),
            StringComparer.Ordinal);
    }

    private sealed record DuplicateHashMatch(string ContentHash, ReleaseTrackId ReleaseTrackId);
}
