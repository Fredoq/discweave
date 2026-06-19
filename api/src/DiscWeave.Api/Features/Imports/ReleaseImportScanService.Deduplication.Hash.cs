using DiscWeave.Domain.Catalog;
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

        LocalAudioFile[] localFiles = await context.LocalAudioFiles.AsNoTracking()
            .Where(file => file.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        LocalAudioFile[] matchingFiles =
        [
            .. localFiles.Where(file =>
                file.ContentHash is PresentOptionalValue<string> hash &&
                contentHashes.Contains(hash.Value, StringComparer.Ordinal))
        ];
        if (matchingFiles.Length == 0)
        {
            return [];
        }

        LocalAudioFileId[] matchingFileIds = [.. matchingFiles.Select(file => file.Id)];
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && matchingFileIds.Contains(link.LocalAudioFileId))
            .ToArrayAsync(cancellationToken);
        ReleaseTrackId[] releaseTrackIds = [.. links.Select(link => link.ReleaseTrackId).Distinct()];
        ReleaseTrack[] releaseTracks = await context.ReleaseTracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId && releaseTrackIds.Contains(track.Id))
            .ToArrayAsync(cancellationToken);

        Dictionary<ReleaseTrackId, ReleaseId> releaseIdByReleaseTrackId = releaseTracks.ToDictionary(track => track.Id, track => track.ReleaseId);
        Dictionary<LocalAudioFileId, string> contentHashByLocalFileId = matchingFiles.ToDictionary(
            file => file.Id,
            file => ((PresentOptionalValue<string>)file.ContentHash).Value);
        DuplicateHashMatch[] rows =
        [
            .. links
                .Where(link => releaseIdByReleaseTrackId.ContainsKey(link.ReleaseTrackId))
                .Where(link => contentHashByLocalFileId.ContainsKey(link.LocalAudioFileId))
                .Select(link => new DuplicateHashMatch(
                    contentHashByLocalFileId[link.LocalAudioFileId],
                    releaseIdByReleaseTrackId[link.ReleaseTrackId]))
        ];

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
