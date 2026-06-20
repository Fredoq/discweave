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

        HashSet<ImportFingerprint> fingerprintSet = [.. fingerprints];
        string[] fingerprintPaths = [.. fingerprints.Select(fingerprint => fingerprint.Path).Distinct(StringComparer.Ordinal)];
        FilePath[] fingerprintFilePaths = [.. fingerprintPaths.Select(FilePath.FromAbsolutePath)];
        LocalAudioFile[] localFiles = await context.LocalAudioFiles.AsNoTracking()
            .Where(file =>
                file.CollectionId == collectionId &&
                (fingerprintPaths.Contains(EF.Property<string>(file, "_importIdentityPath")) ||
                    fingerprintFilePaths.Contains(file.Path)))
            .ToArrayAsync(cancellationToken);
        LocalAudioFile[] matchingFiles =
        [
            .. localFiles.Where(file =>
                MatchingFingerprints(file, fingerprintSet).Length > 0)
        ];
        if (matchingFiles.Length == 0)
        {
            return [];
        }

        LocalAudioFileId[] matchingFileIds = [.. matchingFiles.Select(file => file.Id)];
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && matchingFileIds.Contains(link.LocalAudioFileId))
            .ToArrayAsync(cancellationToken);
        DuplicateFingerprintMatch[] rows =
        [
            .. links
                .Join(matchingFiles, link => link.LocalAudioFileId, file => file.Id, (link, file) => new { link, file })
                .SelectMany(
                    pair => MatchingFingerprints(pair.file, fingerprintSet),
                    (pair, fingerprint) => new DuplicateFingerprintMatch(fingerprint, pair.link.ReleaseTrackId))
        ];

        Dictionary<ReleaseTrackId, DuplicateTrackCandidate> candidatesByReleaseTrackId = await LoadReleaseTrackCandidatesAsync(
            context,
            collectionId,
            [.. rows.Select(row => row.ReleaseTrackId).Distinct()],
            cancellationToken);
        var matches = new Dictionary<ImportFingerprint, List<DuplicateTrackCandidate>>();
        foreach (DuplicateFingerprintMatch row in rows)
        {
            if (!candidatesByReleaseTrackId.TryGetValue(row.ReleaseTrackId, out DuplicateTrackCandidate? candidate))
            {
                continue;
            }

            if (!matches.TryGetValue(row.Fingerprint, out List<DuplicateTrackCandidate>? existing))
            {
                existing = [];
                matches[row.Fingerprint] = existing;
            }

            existing.Add(candidate);
        }

        return matches.ToDictionary(pair => pair.Key, pair => DistinctCandidates(pair.Value));
    }

    private static ImportFingerprint[] MatchingFingerprints(
        LocalAudioFile file,
        HashSet<ImportFingerprint> fingerprints)
    {
        ImportFingerprint[] candidates =
        [
            .. LocalAudioFileFingerprints(file)
                .Where(fingerprints.Contains)
                .Distinct()
        ];

        return candidates;
    }

    private static IEnumerable<ImportFingerprint> LocalAudioFileFingerprints(LocalAudioFile file)
    {
        if (file.ImportIdentity is PresentOptionalValue<FileImportIdentity> identity)
        {
            yield return new ImportFingerprint(
                identity.Value.Path.Value,
                identity.Value.SizeBytes,
                identity.Value.LastModifiedAt);
        }

        if (file.SizeBytes is PresentOptionalValue<long> sizeBytes &&
            file.ModifiedAt is PresentOptionalValue<DateTimeOffset> modifiedAt)
        {
            yield return new ImportFingerprint(file.Path.Value, sizeBytes.Value, modifiedAt.Value);
        }
    }

    private sealed record DuplicateFingerprintMatch(ImportFingerprint Fingerprint, ReleaseTrackId ReleaseTrackId);
}
