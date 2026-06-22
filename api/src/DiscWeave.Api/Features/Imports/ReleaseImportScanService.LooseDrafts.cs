using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Importing;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    public static async Task<ReleaseImportSession?> CreateDraftFromLooseFilesAsync(
        Guid sessionGuid,
        IReadOnlyList<Guid>? candidateGuids,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Guid[] requestedIds = [.. (candidateGuids ?? [])
            .Where(id => id != Guid.Empty)
            .Distinct()];
        if (requestedIds.Length == 0)
        {
            throw new DomainException(
                "release_import_loose_file.selection_required",
                "Select at least one loose file candidate");
        }

        var sessionId = new ReleaseImportSessionId(sessionGuid);
        ReleaseImportSession? session = await context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidateSession => candidateSession.CollectionId == collectionId && candidateSession.Id == sessionId,
            cancellationToken);
        if (session is null)
        {
            return null;
        }

        ReleaseImportLooseFileCandidateId[] candidateIds = [.. requestedIds.Select(id => new ReleaseImportLooseFileCandidateId(id))];
        ReleaseImportLooseFileCandidate[] candidates = await context.ReleaseImportLooseFileCandidates
            .Where(candidate =>
                candidate.CollectionId == collectionId &&
                candidate.SessionId == sessionId &&
                candidateIds.Contains(candidate.Id))
            .ToArrayAsync(cancellationToken);
        if (candidates.Length != candidateIds.Length)
        {
            throw new DomainException(
                "release_import_loose_file.not_found",
                "Loose file candidate was not found");
        }

        ReleaseImportLooseFileCandidate[] orderedCandidates =
        [
            .. candidates
                .OrderBy(candidate => candidate.TrackNumber ?? int.MaxValue)
                .ThenBy(candidate => candidate.RelativePath, StringComparer.OrdinalIgnoreCase)
        ];
        if (orderedCandidates.Any(candidate => candidate.Decision != ReleaseImportLooseFileCandidate.PendingDecision))
        {
            throw new DomainException(
                "release_import_loose_file.already_consumed",
                "Loose file candidate has already been consumed");
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;
        ReleaseFolderScanDraft scannedDraft = ToLooseReleaseDraft(session, orderedCandidates);
        ReleaseImportDraft draft = AddDraft(context, collectionId, sessionId, scannedDraft);
        foreach (ReleaseImportLooseFileCandidate candidate in orderedCandidates)
        {
            candidate.MarkConvertedToDraft(draft.Id, now);
        }

        session.UpdateCounts(
            session.DraftCount + 1,
            session.TrackCount + orderedCandidates.Length,
            session.IgnoredFileCount,
            session.LooseFileCandidateCount,
            now);

        _ = await context.SaveChangesAsync(cancellationToken);
        await ApplyDuplicateTrackMatchesAsync(context, collectionId, session.Id, cancellationToken);
        _ = await context.SaveChangesAsync(cancellationToken);
        await ReleaseImportRelationSuggestionService.GenerateAsync(context, collectionId, session.Id, cancellationToken);
        return session;
    }

    private static ReleaseFolderScanDraft ToLooseReleaseDraft(
        ReleaseImportSession session,
        IReadOnlyList<ReleaseImportLooseFileCandidate> candidates)
    {
        string draftTitle = DraftTitle(candidates);
        IReadOnlyList<string> artistNames = DraftArtistNames(candidates);
        IReadOnlyList<ImportReviewIssue> issues = DraftIssues(candidates);
        string relativePath = DraftRelativePath(candidates);

        return new ReleaseFolderScanDraft(
            session.SourceRoot,
            relativePath,
            draftTitle,
            "unknown",
            null,
            null,
            null,
            null,
            false,
            false,
            null,
            artistNames,
            [],
            [],
            ["local-import", "loose-files"],
            issues,
            null,
            [.. candidates.Select(ToLooseReleaseTrack)]);
    }

    private static ReleaseFolderScanTrack ToLooseReleaseTrack(ReleaseImportLooseFileCandidate candidate, int index)
    {
        IReadOnlyList<ImportReviewIssue> issues = string.IsNullOrWhiteSpace(candidate.ContentHash)
            ? [new ImportReviewIssue(
                ImportIssueCodes.ContentHashMissing,
                "Desktop audio file is missing a SHA-256 content hash; duplicate detection will fall back to path, size, and last modified time")]
            : [];

        return new ReleaseFolderScanTrack(
            candidate.FilePath,
            candidate.RelativePath,
            candidate.Format,
            candidate.SizeBytes,
            candidate.LastModifiedAt,
            candidate.ContentHash,
            candidate.Codec,
            candidate.Quality,
            candidate.Duration,
            candidate.BitrateKbps,
            candidate.SampleRateHz,
            candidate.Channels,
            candidate.TrackNumber ?? (index + 1),
            null,
            null,
            TrimOrNull(candidate.TitleHint) ?? Path.GetFileNameWithoutExtension(candidate.RelativePath),
            candidate.ArtistHints,
            issues);
    }

    private static string DraftTitle(IReadOnlyList<ReleaseImportLooseFileCandidate> candidates)
    {
        string[] albumTitles = DistinctHints(candidates.Select(candidate => candidate.AlbumTitleHint));
        if (albumTitles.Length == 1)
        {
            return albumTitles[0];
        }

        if (candidates.Count == 1)
        {
            ReleaseImportLooseFileCandidate candidate = candidates[0];
            return TrimOrNull(candidate.TitleHint) ?? Path.GetFileNameWithoutExtension(candidate.RelativePath);
        }

        return CommonFolderName(candidates) ?? "Loose files";
    }

    private static IReadOnlyList<string> DraftArtistNames(IReadOnlyList<ReleaseImportLooseFileCandidate> candidates)
    {
        string[] albumArtists = DistinctHints(candidates.SelectMany(candidate => candidate.AlbumArtistHints));
        return albumArtists.Length == 1
            ? albumArtists
            : candidates.Count == 1 && candidates[0].ArtistHints.Count > 0
                ? candidates[0].ArtistHints
                : [];
    }

    private static List<ImportReviewIssue> DraftIssues(IReadOnlyList<ReleaseImportLooseFileCandidate> candidates)
    {
        List<ImportReviewIssue> issues = [];
        if (DistinctHints(candidates.Select(candidate => candidate.AlbumTitleHint)).Length > 1)
        {
            issues.Add(new ImportReviewIssue(
                "release_import.loose_file_album_tag_conflict",
                "Selected loose files have conflicting album tag hints; review the release title before confirming.",
                ImportReviewSeverity.Warning));
        }

        if (DistinctHints(candidates.SelectMany(candidate => candidate.AlbumArtistHints)).Length > 1)
        {
            issues.Add(new ImportReviewIssue(
                "release_import.loose_file_album_artist_conflict",
                "Selected loose files have conflicting album artist tag hints; review release artists before confirming.",
                ImportReviewSeverity.Warning));
        }

        return issues;
    }

    private static string DraftRelativePath(IReadOnlyList<ReleaseImportLooseFileCandidate> candidates)
    {
        return CommonFolderName(candidates) ?? "Loose files";
    }

    private static string? CommonFolderName(IReadOnlyList<ReleaseImportLooseFileCandidate> candidates)
    {
        string[] folders = DistinctHints(candidates.Select(candidate => NormalizeRelativePath(DirectoryRelativePath(candidate.RelativePath))));
        return folders.Length == 1 && !string.IsNullOrWhiteSpace(folders[0])
            ? folders[0]
            : null;
    }

    private static string[] DistinctHints(IEnumerable<string?> values)
    {
        return
        [
            .. values
                .Select(TrimOrNull)
                .Where(value => value is not null)
                .Select(value => value!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
    }
}
