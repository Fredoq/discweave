using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportConfirmationPreflightService
{
    public static async Task<ReleaseImportConfirmationPreflightResponse?> PreflightAsync(
        Guid sessionId,
        Guid draftId,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        var typedSessionId = new ReleaseImportSessionId(sessionId);
        var typedDraftId = new ReleaseImportDraftId(draftId);
        PreflightDraftContext? draftContext = await LoadPreflightDraftContextAsync(context, collectionId, typedSessionId, typedDraftId, cancellationToken);
        if (draftContext is null)
        {
            return null;
        }

        ReleaseImportDraft draft = draftContext.Draft;
        ReleaseImportDraftTrack[] allTracks = await LoadDraftTracksAsync(context, collectionId, draft.Id, cancellationToken);
        ReleaseImportDraftTrack[] includedTracks = [.. allTracks.Where(track => !track.IsSkipped)];
        ReleaseImportDraftTrack[] skippedTracks = [.. allTracks.Where(track => track.IsSkipped)];
        List<ImportIssueResponse> blockingErrors = BlockingErrors(draft, includedTracks);
        PreflightTarget target = await LoadPreflightTargetAsync(
            context,
            collectionId,
            draft,
            includedTracks,
            blockingErrors.Count > 0,
            cancellationToken);
        TrackPlanBuildResult trackPlanBuild = await BuildTrackPlansAsync(
            context,
            collectionId,
            target,
            skippedTracks,
            includedTracks,
            cancellationToken);

        int reusedTracks = includedTracks.Count(track => track.SelectedTrackId.HasValue);
        int newTracks = includedTracks.Length - reusedTracks;
        ReleaseImportConfirmationSummaryResponse summary = Summary(
            includedTracks.Length,
            skippedTracks.Length,
            reusedTracks,
            newTracks,
            blockingErrors.Count > 0,
            target,
            trackPlanBuild.Counters);

        return new ReleaseImportConfirmationPreflightResponse(
            draftContext.Session.Id.Value,
            draft.Id.Value,
            DraftStatusCode(draft.Status),
            CanConfirm: blockingErrors.Count == 0,
            target.Outcome,
            summary,
            Actions(summary),
            [.. trackPlanBuild.Plans.OrderBy(track => track.Position ?? 9999).ThenBy(track => track.Title)],
            Issues(draft, allTracks),
            blockingErrors);
    }

    private static async Task<PreflightDraftContext?> LoadPreflightDraftContextAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        CancellationToken cancellationToken)
    {
        ReleaseImportSession? session = await context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.Id == sessionId,
            cancellationToken);
        ReleaseImportDraft? draft = await context.ReleaseImportDrafts.SingleOrDefaultAsync(
            candidate =>
                candidate.CollectionId == collectionId &&
                candidate.SessionId == sessionId &&
                candidate.Id == draftId,
            cancellationToken);

        return session is null || draft is null ? null : new PreflightDraftContext(session, draft);
    }

    private static async Task<ReleaseImportDraftTrack[]> LoadDraftTracksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraftId draftId,
        CancellationToken cancellationToken)
    {
        return await context.ReleaseImportDraftTracks
            .Where(track => track.CollectionId == collectionId && track.DraftId == draftId)
            .OrderBy(track => track.Position ?? 9999)
            .ThenBy(track => track.RelativePath)
            .ToArrayAsync(cancellationToken);
    }

    private static List<ImportIssueResponse> BlockingErrors(
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] includedTracks)
    {
        List<ImportIssueResponse> errors = [];
        if (draft.Status == ReleaseImportDraftStatus.Skipped)
        {
            errors.Add(new ImportIssueResponse(
                "release_import_draft.skipped",
                "Skipped release import drafts cannot be confirmed",
                IssueSeverityError));
        }

        if (includedTracks.Length == 0)
        {
            errors.Add(new ImportIssueResponse(
                "release_import.tracks_required",
                "Release import draft has no tracks to confirm",
                IssueSeverityError));
        }

        if (draft.Status == ReleaseImportDraftStatus.Confirmed)
        {
            errors.Add(new ImportIssueResponse(
                "release_import_draft.confirmed",
                "Confirmed release import drafts cannot be changed",
                IssueSeverityError));
        }

        return errors;
    }

    private static async Task<PreflightTarget> LoadPreflightTargetAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] includedTracks,
        bool isBlocked,
        CancellationToken cancellationToken)
    {
        if (isBlocked)
        {
            return new PreflightTarget(OutcomeBlocked, null, null);
        }

        Release? exactDuplicate = await ReleaseImportConfirmationService.FindExistingReleaseForSelectedTracksAsync(
            context,
            collectionId,
            draft,
            includedTracks,
            cancellationToken);
        Release? partialDuplicate = exactDuplicate is null
            ? await ReleaseImportConfirmationService.FindPartialDuplicateReleaseAsync(
                context,
                collectionId,
                draft,
                includedTracks,
                cancellationToken)
            : null;
        Release? targetRelease = exactDuplicate ?? partialDuplicate;
        OwnedItem? digitalOwnedItem = targetRelease is null
            ? null
            : await FindDigitalOwnedItemAsync(context, collectionId, targetRelease.Id, cancellationToken);

        return new PreflightTarget(Outcome(exactDuplicate, partialDuplicate, false), targetRelease, digitalOwnedItem);
    }

    private static ReleaseImportConfirmationSummaryResponse Summary(
        int includedTrackCount,
        int skippedTrackCount,
        int reusedTracks,
        int newTracks,
        bool isBlocked,
        PreflightTarget target,
        TrackPlanCounters counters)
    {
        return new ReleaseImportConfirmationSummaryResponse(
            IncludedTrackCount: includedTrackCount,
            SkippedTrackCount: skippedTrackCount,
            DuplicateTrackCount: reusedTracks,
            NewReleases: target.Outcome == OutcomeNewRelease ? 1 : 0,
            ReusedReleases: target.Outcome == OutcomeExactDuplicate ? 1 : 0,
            UpdatedReleases: target.Outcome == OutcomePartialDuplicate ? 1 : 0,
            NewTracks: newTracks,
            ReusedTracks: reusedTracks,
            NewDigitalOwnedItems: !isBlocked && target.DigitalOwnedItem is null ? 1 : 0,
            ReusedDigitalOwnedItems: target.DigitalOwnedItem is null ? 0 : 1,
            NewLocalAudioFiles: counters.NewLocalAudioFiles,
            UpdatedLocalAudioFiles: counters.UpdatedLocalAudioFiles,
            NewDigitalTrackFileLinks: counters.NewDigitalTrackFileLinks,
            RelinkedDigitalTrackFileLinks: counters.RelinkedDigitalTrackFileLinks,
            UnchangedDigitalTrackFileLinks: counters.UnchangedDigitalTrackFileLinks);
    }

    private sealed record PreflightDraftContext(ReleaseImportSession Session, ReleaseImportDraft Draft);

    private sealed record PreflightTarget(string Outcome, Release? Release, OwnedItem? DigitalOwnedItem);

}
