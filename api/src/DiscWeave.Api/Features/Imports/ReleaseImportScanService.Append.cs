using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Importing;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportScanService
{
    // Appends a partial rescan of a watched folder to its existing session. A scanned release whose
    // files are all already drafted in the session is skipped, so repeated checks never duplicate drafts.
    public static async Task<ReleaseImportSession?> AppendDesktopAsync(
        Guid sessionGuid,
        DesktopFolderScanAppendRequest request,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        var sessionId = new ReleaseImportSessionId(sessionGuid);
        ReleaseImportSession? session = await context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.Id == sessionId,
            cancellationToken);
        if (session is null)
        {
            return null;
        }

        string sourceRoot = RequiredLocalFileSourceRoot(session);
        ReleaseFolderScanPayload scan = await BuildValidatedScanAsync(request?.Scan, context, collectionId, cancellationToken);
        if (!string.Equals(scan.SourceRoot, sourceRoot, StringComparison.Ordinal))
        {
            throw new DomainException(
                "release_import.source_root_mismatch",
                "Appended desktop scan must use the import session source root");
        }

        ReleaseImportDraft[] drafts = await context.ReleaseImportDrafts
            .Where(draft => draft.CollectionId == collectionId && draft.SessionId == sessionId)
            .ToArrayAsync(cancellationToken);
        ReleaseImportDraft[] replacedDrafts = await ReplaceableDraftsAsync(
            context,
            collectionId,
            sessionId,
            drafts,
            request?.ReplaceDraftIds,
            cancellationToken);
        if (replacedDrafts.Length > 0 && scan.Drafts.Count == 0)
        {
            throw new DomainException(
                "release_import.draft_recreate_empty",
                "The rescanned folder has no release files to recreate the draft from");
        }

        HashSet<ReleaseImportDraftId> replacedDraftIds = [.. replacedDrafts.Select(draft => draft.Id)];
        ReleaseImportDraftId[] keptDraftIds = [.. drafts.Select(draft => draft.Id).Where(id => !replacedDraftIds.Contains(id))];
        ReleaseImportDraftTrack[] keptTracks = await context.ReleaseImportDraftTracks.AsNoTracking()
            .Where(track => track.CollectionId == collectionId && keptDraftIds.Contains(track.DraftId))
            .ToArrayAsync(cancellationToken);
        HashSet<string> draftedFilePaths = new(StringComparer.Ordinal);
        foreach (ReleaseImportDraftTrack track in keptTracks)
        {
            if (track.LocalFile is PresentOptionalValue<ReleaseImportLocalFileDescriptor> localFile)
            {
                _ = draftedFilePaths.Add(localFile.Value.FilePath);
            }
        }

        context.ReleaseImportDrafts.RemoveRange(replacedDrafts);
        ReleaseFolderScanDraft[] newDrafts =
        [
            .. scan.Drafts.Where(draft => draft.Tracks.Any(track => !draftedFilePaths.Contains(track.FilePath)))
        ];
        foreach (ReleaseFolderScanDraft scannedDraft in newDrafts)
        {
            _ = AddDraft(context, collectionId, sessionId, scannedDraft);
        }

        DateTimeOffset now = DateTimeOffset.UtcNow;
        int addedLooseCandidates = await AddNewLooseFileCandidatesAsync(context, session, scan, draftedFilePaths, now, cancellationToken);
        foreach (DesktopFolderScanDiagnosticRequest diagnostic in request?.Scan?.Diagnostics ?? [])
        {
            _ = context.ReleaseImportScanDiagnostics.Add(ToScanDiagnostic(collectionId, sessionId, diagnostic, now));
        }

        session.UpdateCounts(
            keptDraftIds.Length + newDrafts.Length,
            keptTracks.Length + newDrafts.Sum(draft => draft.Tracks.Count),
            session.IgnoredFileCount + scan.IgnoredFileCount,
            session.LooseFileCandidateCount + addedLooseCandidates,
            now);
        if (newDrafts.Length > 0)
        {
            session.Reopen(now);
        }

        _ = await context.SaveChangesAsync(cancellationToken);
        await ApplyDuplicateTrackMatchesAsync(context, collectionId, session.Id, cancellationToken);
        _ = await context.SaveChangesAsync(cancellationToken);
        await ReleaseImportRelationSuggestionService.GenerateAsync(context, collectionId, session.Id, cancellationToken);
        return session;
    }

    private static async Task<ReleaseImportDraft[]> ReplaceableDraftsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraft[] drafts,
        IReadOnlyList<Guid>? replaceDraftIds,
        CancellationToken cancellationToken)
    {
        HashSet<Guid> requestedIds = [.. replaceDraftIds ?? []];
        if (requestedIds.Count == 0)
        {
            return [];
        }

        ReleaseImportDraft[] replaced = [.. drafts.Where(draft => requestedIds.Contains(draft.Id.Value))];
        if (replaced.Length != requestedIds.Count)
        {
            throw new DomainException("release_import_draft.not_found", "Release import draft was not found");
        }

        if (replaced.Any(draft => draft.Status == ReleaseImportDraftStatus.Confirmed))
        {
            throw new DomainException(
                "release_import.confirmed_draft_cannot_be_recreated",
                "Confirmed import drafts cannot be recreated because catalog data must remain safe");
        }

        HashSet<ReleaseImportDraftId> replacedIds = [.. replaced.Select(draft => draft.Id)];
        ReleaseImportDraftId?[] looseSourceDraftIds = await context.ReleaseImportLooseFileCandidates.AsNoTracking()
            .Where(candidate => candidate.CollectionId == collectionId && candidate.SessionId == sessionId)
            .Select(candidate => candidate.SourceDraftId)
            .ToArrayAsync(cancellationToken);
        bool createdFromLooseFiles = looseSourceDraftIds.Any(id => id is { } draftId && replacedIds.Contains(draftId));
        return createdFromLooseFiles
            ? throw new DomainException(
                "release_import.loose_file_draft_cannot_be_recreated",
                "Drafts created from loose files cannot be recreated from a folder rescan")
            : replaced;
    }

    private static async Task<int> AddNewLooseFileCandidatesAsync(
        DiscWeaveDbContext context,
        ReleaseImportSession session,
        ReleaseFolderScanPayload scan,
        HashSet<string> draftedFilePaths,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (scan.LooseFileCandidates.Count == 0)
        {
            return 0;
        }

        string[] existingRelativePaths = await context.ReleaseImportLooseFileCandidates.AsNoTracking()
            .Where(candidate => candidate.CollectionId == session.CollectionId && candidate.SessionId == session.Id)
            .Select(candidate => candidate.RelativePath)
            .ToArrayAsync(cancellationToken);
        HashSet<string> knownRelativePaths = new(existingRelativePaths, StringComparer.Ordinal);
        int added = 0;
        foreach (ReleaseFolderLooseFileCandidate candidate in scan.LooseFileCandidates)
        {
            if (draftedFilePaths.Contains(candidate.FilePath) || !knownRelativePaths.Add(candidate.RelativePath))
            {
                continue;
            }

            _ = context.ReleaseImportLooseFileCandidates.Add(ToLooseFileCandidate(session.CollectionId, session.Id, candidate, now));
            added++;
        }

        return added;
    }
}
