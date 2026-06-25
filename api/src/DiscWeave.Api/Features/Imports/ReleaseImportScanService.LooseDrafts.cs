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
        ReleaseImportLooseFileDraftRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        Guid[] requestedIds = [.. (request.CandidateIds ?? [])
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

        IReadOnlyList<string> releaseTemplates = await ImportPatternDefaults.ActiveTemplatesAsync(
            context,
            collectionId,
            ImportPatternKind.ReleaseFolder,
            cancellationToken);

        DateTimeOffset now = DateTimeOffset.UtcNow;
        ReleaseFolderScanDraft scannedDraft = ToLooseReleaseDraft(session, orderedCandidates, request, releaseTemplates);
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
        session.Reopen(now);

        _ = await context.SaveChangesAsync(cancellationToken);
        await ApplyDuplicateTrackMatchesAsync(context, collectionId, session.Id, cancellationToken);
        _ = await context.SaveChangesAsync(cancellationToken);
        await ReleaseImportRelationSuggestionService.GenerateAsync(context, collectionId, session.Id, cancellationToken);
        return session;
    }

    private static ReleaseFolderScanDraft ToLooseReleaseDraft(
        ReleaseImportSession session,
        IReadOnlyList<ReleaseImportLooseFileCandidate> candidates,
        ReleaseImportLooseFileDraftRequest request,
        IReadOnlyList<string> releaseTemplates)
    {
        string relativePath = DraftRelativePath(candidates);
        ParsedReleaseFolder? parsed = ParseLooseReleaseFolder(relativePath, releaseTemplates);
        string draftTitle = TrimOrNull(request.ReviewedTitle) ?? DraftTitle(candidates, parsed);
        IReadOnlyList<string> artistNames = ReviewedArtistNames(request) ?? DraftArtistNames(candidates, parsed);
        IReadOnlyList<ImportReviewIssue> issues = [.. (parsed?.Issues ?? []).Concat(DraftIssues(candidates))];

        return new ReleaseFolderScanDraft(
            session.SourceRoot,
            relativePath,
            draftTitle,
            "unknown",
            parsed?.CatalogNumber,
            null,
            parsed?.ReleaseDate,
            parsed?.Year,
            parsed?.IsVariousArtists ?? false,
            false,
            null,
            artistNames.Count > 0 ? artistNames : parsed?.ArtistNames ?? [],
            [],
            [],
            [],
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

    private static string DraftTitle(IReadOnlyList<ReleaseImportLooseFileCandidate> candidates, ParsedReleaseFolder? parsed)
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

        return parsed?.Title ?? CommonFolderName(candidates) ?? "Loose files";
    }

    private static IReadOnlyList<string> DraftArtistNames(
        IReadOnlyList<ReleaseImportLooseFileCandidate> candidates,
        ParsedReleaseFolder? parsed)
    {
        string[] albumArtists = DistinctHints(candidates.SelectMany(candidate => candidate.AlbumArtistHints));
        return (albumArtists.Length, candidates.Count) switch
        {
            (1, _) => albumArtists,
            (_, 1) when candidates[0].ArtistHints.Count > 0 => candidates[0].ArtistHints,
            _ => parsed?.ArtistNames ?? []
        };
    }

    private static string[]? ReviewedArtistNames(ReleaseImportLooseFileDraftRequest request)
    {
        string[] names =
        [
            .. (request.ReviewedArtistNames ?? [])
                .Select(TrimOrNull)
                .Where(name => name is not null)
                .Select(name => name!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];

        return names.Length > 0 ? names : null;
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

    private static ParsedReleaseFolder? ParseLooseReleaseFolder(
        string relativePath,
        IReadOnlyList<string> releaseTemplates)
    {
        return relativePath == "Loose files"
            ? null
            : ReleaseFolderNameParser.Parse(LastSegment(relativePath), releaseTemplates);
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
