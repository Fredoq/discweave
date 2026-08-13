using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    private const string DuplicateFileIssueCode = "release_import.duplicate_file";

    private static async Task ApplyDuplicateTrackMatchesAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        CancellationToken cancellationToken)
    {
        ReleaseImportDraftId[] draftIds =
        [
            .. await context.ReleaseImportDrafts
                .Where(draft => draft.CollectionId == collectionId && draft.SessionId == sessionId)
                .Select(draft => draft.Id)
                .ToArrayAsync(cancellationToken)
        ];
        ReleaseImportDraftTrack[] tracks = await context.ReleaseImportDraftTracks
            .Where(track => track.CollectionId == collectionId && draftIds.Contains(track.DraftId))
            .ToArrayAsync(cancellationToken);
        IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> duplicateTrackIds =
            await FindDuplicateTrackIdsAsync(context, collectionId, tracks, cancellationToken);

        foreach (ReleaseImportDraftTrack track in tracks)
        {
            if (!duplicateTrackIds.TryGetValue(track.Id, out TrackId duplicateTrackId))
            {
                continue;
            }

            ImportReviewIssue[] issues =
            [
                .. track.Issues.Where(issue => issue.Code != DuplicateFileIssueCode),
                new ImportReviewIssue(DuplicateFileIssueCode, "This audio file already exists in the collection")
            ];
            track.UpdateEditableFields(new DraftTrackEditableFields(
                track.Position,
                track.Disc,
                track.Side,
                track.Title,
                track.Duration,
                track.VersionYear,
                track.ArtistNames,
                track.ArtistCredits,
                track.InheritReleaseArtistCredits,
                track.SelectedArtistIds,
                ReleaseImportTrackMode.Link,
                duplicateTrackId,
                track.IsSkipped,
                issues));
        }
    }

    private static async Task<IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId>> FindDuplicateTrackIdsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<ReleaseImportDraftTrack> tracks,
        CancellationToken cancellationToken)
    {
        var matches = new Dictionary<ReleaseImportDraftTrackId, TrackId>();
        ReleaseImportDraftTrack[] localFileTracks =
        [
            .. tracks.Where(track => track.SourceKind == ReleaseImportSourceKind.LocalFiles)
        ];
        if (localFileTracks.Length == 0)
        {
            return matches;
        }

        foreach (ReleaseImportDraftTrack track in localFileTracks)
        {
            _ = RequiredLocalFile(track);
        }

        string[] contentHashes =
        [
            .. localFileTracks
                .Select(track => NormalizeContentHash(RequiredLocalFile(track).ContentHash))
                .OfType<string>()
                .Distinct(StringComparer.Ordinal)
        ];
        Dictionary<string, DuplicateTrackCandidate[]> hashMatches = await LoadHashDuplicateMatchesAsync(
            context,
            collectionId,
            contentHashes,
            cancellationToken);
        foreach (ReleaseImportDraftTrack track in localFileTracks)
        {
            string? normalizedHash = NormalizeContentHash(RequiredLocalFile(track).ContentHash);
            if (normalizedHash is not null &&
                hashMatches.TryGetValue(normalizedHash, out DuplicateTrackCandidate[]? candidates) &&
                SelectDuplicateTrackId(track, candidates) is { } duplicateTrackId)
            {
                matches[track.Id] = duplicateTrackId;
            }
        }

        ReleaseImportDraftTrack[] remainingTracks = [.. localFileTracks.Where(track => !matches.ContainsKey(track.Id))];
        Dictionary<ImportFingerprint, DuplicateTrackCandidate[]> fingerprintMatches = await LoadFingerprintDuplicateMatchesAsync(
            context,
            collectionId,
            remainingTracks,
            cancellationToken);
        foreach (ReleaseImportDraftTrack track in remainingTracks)
        {
            ReleaseImportLocalFileDescriptor localFile = RequiredLocalFile(track);
            var fingerprint = new ImportFingerprint(localFile.FilePath, localFile.SizeBytes, localFile.LastModifiedAt);
            if (fingerprintMatches.TryGetValue(fingerprint, out DuplicateTrackCandidate[]? candidates) &&
                SelectDuplicateTrackId(track, candidates) is { } duplicateTrackId)
            {
                matches[track.Id] = duplicateTrackId;
            }
        }

        return matches;
    }

    private static ReleaseImportLocalFileDescriptor RequiredLocalFile(ReleaseImportDraftTrack track)
    {
        return track.LocalFile is PresentOptionalValue<ReleaseImportLocalFileDescriptor> localFile
            ? localFile.Value
            : throw new DomainException(
                "release_import.local_file_required",
                "Local file import track is missing its local file descriptor during duplicate detection");
    }

    private readonly record struct ImportFingerprint(string Path, long SizeBytes, DateTimeOffset LastModifiedAt);
}
