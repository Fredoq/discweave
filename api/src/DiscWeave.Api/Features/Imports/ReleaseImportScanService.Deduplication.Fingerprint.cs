using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
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
        ImportFingerprint[] fingerprints =
        [
            .. tracks
                .Select(track => new ImportFingerprint(track.FilePath, track.SizeBytes, track.LastModifiedAt))
                .Distinct()
        ];
        if (fingerprints.Length == 0)
        {
            return [];
        }

        LocalAudioFile[] localFiles = await context.LocalAudioFiles.AsNoTracking()
            .Where(file => file.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        LocalAudioFile[] matchingFiles =
        [
            .. localFiles.Where(file =>
                file.ImportIdentity is PresentOptionalValue<FileImportIdentity> identity &&
                fingerprints.Contains(new ImportFingerprint(
                    identity.Value.Path.Value,
                    identity.Value.SizeBytes,
                    identity.Value.LastModifiedAt)))
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
        DuplicateFingerprintMatch[] rows =
        [
            .. links
                .Join(matchingFiles, link => link.LocalAudioFileId, file => file.Id, (link, file) => new { link, file })
                .Where(pair => releaseIdByReleaseTrackId.ContainsKey(pair.link.ReleaseTrackId))
                .Select(pair =>
                {
                    FileImportIdentity identity = ((PresentOptionalValue<FileImportIdentity>)pair.file.ImportIdentity).Value;
                    return new DuplicateFingerprintMatch(
                        new ImportFingerprint(identity.Path.Value, identity.SizeBytes, identity.LastModifiedAt),
                        releaseIdByReleaseTrackId[pair.link.ReleaseTrackId]);
                })
        ];

        Dictionary<ReleaseId, DuplicateTrackCandidate[]> candidatesByReleaseId = await LoadReleaseTrackCandidatesAsync(
            context,
            collectionId,
            [.. rows.Select(row => row.ReleaseId).Distinct()],
            cancellationToken);
        var matches = new Dictionary<ImportFingerprint, List<DuplicateTrackCandidate>>();
        foreach (DuplicateFingerprintMatch row in rows)
        {
            if (!candidatesByReleaseId.TryGetValue(row.ReleaseId, out DuplicateTrackCandidate[]? candidates))
            {
                continue;
            }

            if (!matches.TryGetValue(row.Fingerprint, out List<DuplicateTrackCandidate>? existing))
            {
                existing = [];
                matches[row.Fingerprint] = existing;
            }

            existing.AddRange(candidates);
        }

        return matches.ToDictionary(pair => pair.Key, pair => DistinctCandidates(pair.Value));
    }

    private sealed record DuplicateFingerprintMatch(ImportFingerprint Fingerprint, ReleaseId ReleaseId);
}
