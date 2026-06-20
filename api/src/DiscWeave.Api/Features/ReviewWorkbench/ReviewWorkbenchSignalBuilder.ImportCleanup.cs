using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.ReviewWorkbench;

public static partial class ReviewWorkbenchSignalBuilder
{
    private const string DuplicateFileIssueCode = "release_import.duplicate_file";
    private const string RelationIssueCodePrefix = "release_import_relation.";

    private static async Task<IEnumerable<ReviewWorkbenchSignal>> ImportCleanupSignalsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles,
        CancellationToken cancellationToken)
    {
        ReleaseImportSession[] sessions = await context.ReleaseImportSessions.AsNoTracking()
            .Where(session => session.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        if (sessions.Length == 0)
        {
            return [];
        }

        ReleaseImportSessionId[] sessionIds = [.. sessions.Select(session => session.Id)];
        ReleaseImportDraft[] drafts = await context.ReleaseImportDrafts.AsNoTracking()
            .Where(draft => draft.CollectionId == collectionId && sessionIds.Contains(draft.SessionId))
            .ToArrayAsync(cancellationToken);
        ReleaseImportDraftId[] draftIds = [.. drafts.Select(draft => draft.Id)];
        ReleaseImportDraftTrack[] draftTracks = draftIds.Length == 0
            ? []
            : await context.ReleaseImportDraftTracks.AsNoTracking()
                .Where(track => track.CollectionId == collectionId && draftIds.Contains(track.DraftId))
                .ToArrayAsync(cancellationToken);
        ReleaseImportRelationSuggestion[] relationSuggestions = draftIds.Length == 0
            ? []
            : await context.ReleaseImportRelationSuggestions.AsNoTracking()
                .Where(suggestion => suggestion.CollectionId == collectionId && draftIds.Contains(suggestion.DraftId))
                .ToArrayAsync(cancellationToken);

        Dictionary<ReleaseImportSessionId, ReleaseImportSession> sessionsById = sessions.ToDictionary(session => session.Id);
        Dictionary<ReleaseImportDraftId, ReleaseImportDraft> draftsById = drafts.ToDictionary(draft => draft.Id);
        var signals = new List<ReviewWorkbenchSignal>();

        AddConfirmedDraftIssueSignals(
            signals,
            collectionId,
            drafts,
            sessionsById,
            releaseTitles,
            trackTitles);
        AddDuplicateImportOutcomeSignals(
            signals,
            collectionId,
            draftTracks,
            draftsById,
            sessionsById,
            releaseTitles,
            trackTitles);
        AddRejectedRelationSuggestionSignals(
            signals,
            collectionId,
            relationSuggestions,
            draftsById,
            sessionsById,
            releaseTitles,
            trackTitles);

        return signals;
    }

    private static void AddConfirmedDraftIssueSignals(
        List<ReviewWorkbenchSignal> signals,
        CollectionId collectionId,
        IEnumerable<ReleaseImportDraft> drafts,
        Dictionary<ReleaseImportSessionId, ReleaseImportSession> sessionsById,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        foreach (ReleaseImportDraft draft in drafts.Where(draft => draft.Status == ReleaseImportDraftStatus.Confirmed))
        {
            foreach (ImportReviewIssue issue in draft.Issues.Where(ShouldSurfaceDraftIssue))
            {
                signals.Add(ImportIssueSignal(
                    collectionId,
                    draft,
                    sessionsById[draft.SessionId],
                    issue,
                    ImportIssueSubtype(issue),
                    releaseTitles,
                    trackTitles));
            }
        }
    }

    private static void AddDuplicateImportOutcomeSignals(
        List<ReviewWorkbenchSignal> signals,
        CollectionId collectionId,
        IEnumerable<ReleaseImportDraftTrack> draftTracks,
        Dictionary<ReleaseImportDraftId, ReleaseImportDraft> draftsById,
        Dictionary<ReleaseImportSessionId, ReleaseImportSession> sessionsById,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        foreach (ReleaseImportDraftTrack draftTrack in draftTracks.Where(track => track.Issues.Any(issue => issue.Code == DuplicateFileIssueCode)))
        {
            if (!draftsById.TryGetValue(draftTrack.DraftId, out ReleaseImportDraft? draft) ||
                draft.Status != ReleaseImportDraftStatus.Confirmed ||
                !sessionsById.TryGetValue(draft.SessionId, out ReleaseImportSession? session))
            {
                continue;
            }

            foreach (ImportReviewIssue issue in draftTrack.Issues.Where(issue => issue.Code == DuplicateFileIssueCode))
            {
                signals.Add(DuplicateImportOutcomeSignal(
                    collectionId,
                    session,
                    draft,
                    draftTrack,
                    issue,
                    releaseTitles,
                    trackTitles));
            }
        }
    }

    private static void AddRejectedRelationSuggestionSignals(
        List<ReviewWorkbenchSignal> signals,
        CollectionId collectionId,
        IEnumerable<ReleaseImportRelationSuggestion> relationSuggestions,
        Dictionary<ReleaseImportDraftId, ReleaseImportDraft> draftsById,
        Dictionary<ReleaseImportSessionId, ReleaseImportSession> sessionsById,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        foreach (ReleaseImportRelationSuggestion suggestion in relationSuggestions.Where(suggestion => suggestion.Decision == ReleaseImportRelationSuggestionDecision.Rejected))
        {
            if (!draftsById.TryGetValue(suggestion.DraftId, out ReleaseImportDraft? draft) ||
                draft.Status != ReleaseImportDraftStatus.Confirmed ||
                !sessionsById.TryGetValue(suggestion.SessionId, out ReleaseImportSession? session))
            {
                continue;
            }

            signals.Add(RejectedRelationSuggestionSignal(
                collectionId,
                session,
                draft,
                suggestion,
                releaseTitles,
                trackTitles));
        }
    }

    private static bool ShouldSurfaceDraftIssue(ImportReviewIssue issue)
    {
        return issue.Code != DuplicateFileIssueCode && issue.Severity is ImportReviewSeverity.Warning or ImportReviewSeverity.Error;
    }

    private static string ImportIssueSubtype(ImportReviewIssue issue)
    {
        return issue.Code.StartsWith(RelationIssueCodePrefix, StringComparison.Ordinal)
            ? ReviewWorkbenchSubtypes.SkippedRelationSuggestions
            : ReviewWorkbenchSubtypes.ConfirmedImportWarnings;
    }

    private static ReviewWorkbenchSignal ImportIssueSignal(
        CollectionId collectionId,
        ReleaseImportDraft draft,
        ReleaseImportSession session,
        ImportReviewIssue issue,
        string subtype,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        return CreateSignal(
            collectionId,
            ReviewWorkbenchCategories.ImportCleanup,
            subtype,
            $"Import warning: {draft.Title} - {issue.Message}",
            ImportTargets(session, draft, releaseTitles, trackTitles),
            $"{draft.Id.Value:D}|{issue.Code}|{issue.Message}",
            ReviewWorkbenchSourceDetectors.ImportReview);
    }

    private static ReviewWorkbenchSignal DuplicateImportOutcomeSignal(
        CollectionId collectionId,
        ReleaseImportSession session,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack draftTrack,
        ImportReviewIssue issue,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        List<ReviewWorkbenchSignalTarget> targets = [.. ImportTargets(session, draft, releaseTitles, trackTitles)];
        if (draftTrack.SelectedTrackId is { } trackId)
        {
            string trackTitle = ResolveTargetTitle(ReviewWorkbenchTargetKinds.Track, trackId.Value, releaseTitles, trackTitles);
            targets.Insert(0, Target(ReviewWorkbenchTargetKinds.Track, trackId.Value, trackTitle, draftTrack.FilePath));
        }

        return CreateSignal(
            collectionId,
            ReviewWorkbenchCategories.ImportCleanup,
            ReviewWorkbenchSubtypes.DuplicateImportOutcomes,
            $"Import duplicate outcome: {draft.Title} - {draftTrack.Title}",
            targets,
            $"{draftTrack.Id.Value:D}|{issue.Code}|{draftTrack.FilePath}",
            ReviewWorkbenchSourceDetectors.ImportReview);
    }

    private static ReviewWorkbenchSignal RejectedRelationSuggestionSignal(
        CollectionId collectionId,
        ReleaseImportSession session,
        ReleaseImportDraft draft,
        ReleaseImportRelationSuggestion suggestion,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        return CreateSignal(
            collectionId,
            ReviewWorkbenchCategories.ImportCleanup,
            ReviewWorkbenchSubtypes.SkippedRelationSuggestions,
            $"Import relation suggestion skipped: {draft.Title} - {suggestion.Token}",
            ImportTargets(session, draft, releaseTitles, trackTitles),
            $"{suggestion.Id.Value:D}|{suggestion.Token}",
            ReviewWorkbenchSourceDetectors.ImportReview);
    }

    private static ReviewWorkbenchSignalTarget[] ImportTargets(
        ReleaseImportSession session,
        ReleaseImportDraft draft,
        IReadOnlyDictionary<Guid, string> releaseTitles,
        IReadOnlyDictionary<Guid, string> trackTitles)
    {
        List<ReviewWorkbenchSignalTarget> targets = [];
        if (draft.ConfirmedReleaseId is { } releaseId)
        {
            string releaseTitle = ResolveTargetTitle(ReviewWorkbenchTargetKinds.Release, releaseId.Value, releaseTitles, trackTitles);
            targets.Add(Target(ReviewWorkbenchTargetKinds.Release, releaseId.Value, releaseTitle, draft.RelativePath));
        }

        targets.Add(Target(
            ReviewWorkbenchTargetKinds.ImportSession,
            session.Id.Value,
            $"Import session: {session.SourceRoot}",
            draft.RelativePath));

        return [.. targets];
    }
}
