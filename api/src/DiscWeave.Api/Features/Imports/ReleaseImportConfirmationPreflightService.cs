using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationPreflightService
{
    public async Task<ReleaseImportConfirmationPreflightResponse?> PreflightAsync(
        Guid sessionId,
        Guid draftId,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        var typedSessionId = new ReleaseImportSessionId(sessionId);
        var typedDraftId = new ReleaseImportDraftId(draftId);
        ReleaseImportSession? session = await context.ReleaseImportSessions.SingleOrDefaultAsync(
            candidate => candidate.CollectionId == collectionId && candidate.Id == typedSessionId,
            cancellationToken);
        ReleaseImportDraft? draft = await context.ReleaseImportDrafts.SingleOrDefaultAsync(
            candidate =>
                candidate.CollectionId == collectionId &&
                candidate.SessionId == typedSessionId &&
                candidate.Id == typedDraftId,
            cancellationToken);
        if (session is null || draft is null)
        {
            return null;
        }

        ReleaseImportDraftTrack[] allTracks = await context.ReleaseImportDraftTracks
            .Where(track => track.CollectionId == collectionId && track.DraftId == draft.Id)
            .OrderBy(track => track.Position ?? 9999)
            .ThenBy(track => track.RelativePath)
            .ToArrayAsync(cancellationToken);
        ReleaseImportDraftTrack[] includedTracks = [.. allTracks.Where(track => !track.IsSkipped)];
        ReleaseImportDraftTrack[] skippedTracks = [.. allTracks.Where(track => track.IsSkipped)];
        List<ImportIssueResponse> blockingErrors = [];

        if (draft.Status == ReleaseImportDraftStatus.Skipped)
        {
            blockingErrors.Add(new ImportIssueResponse(
                "release_import_draft.skipped",
                "Skipped release import drafts cannot be confirmed",
                "error"));
        }

        if (includedTracks.Length == 0)
        {
            blockingErrors.Add(new ImportIssueResponse(
                "release_import.tracks_required",
                "Release import draft has no tracks to confirm",
                "error"));
        }

        if (draft.Status == ReleaseImportDraftStatus.Confirmed)
        {
            blockingErrors.Add(new ImportIssueResponse(
                "release_import_draft.confirmed",
                "Confirmed release import drafts cannot be changed",
                "error"));
        }

        Release? exactDuplicate = blockingErrors.Count == 0
            ? await ReleaseImportConfirmationService.FindExistingReleaseForSelectedTracksAsync(
                context,
                collectionId,
                draft,
                includedTracks,
                cancellationToken)
            : null;
        Release? partialDuplicate = exactDuplicate is null && blockingErrors.Count == 0
            ? await ReleaseImportConfirmationService.FindPartialDuplicateReleaseAsync(
                context,
                collectionId,
                draft,
                includedTracks,
                cancellationToken)
            : null;
        string outcome = Outcome(exactDuplicate, partialDuplicate, blockingErrors.Count > 0);
        Release? targetRelease = exactDuplicate ?? partialDuplicate;
        OwnedItem? digitalOwnedItem = targetRelease is null
            ? null
            : await FindDigitalOwnedItemAsync(context, collectionId, targetRelease.Id, cancellationToken);

        List<ReleaseImportConfirmationTrackPlanResponse> trackPlans = [];
        int newLocalAudioFiles = 0;
        int updatedLocalAudioFiles = 0;
        int newDigitalTrackFileLinks = 0;
        int relinkedDigitalTrackFileLinks = 0;
        int unchangedDigitalTrackFileLinks = 0;

        foreach (ReleaseImportDraftTrack skippedTrack in skippedTracks)
        {
            trackPlans.Add(new ReleaseImportConfirmationTrackPlanResponse(
                skippedTrack.Id.Value,
                skippedTrack.Title,
                skippedTrack.Position,
                IsSkipped: true,
                skippedTrack.SelectedTrackId?.Value,
                "skip",
                "skip",
                "skip"));
        }

        foreach (ReleaseImportDraftTrack includedTrack in includedTracks)
        {
            string trackAction = includedTrack.SelectedTrackId.HasValue ? "reuse" : "create";
            LocalAudioFile? localFile = await FindLocalAudioFileAsync(context, collectionId, includedTrack, cancellationToken);
            string localFileAction;
            if (localFile is null)
            {
                localFileAction = "create";
                newLocalAudioFiles++;
            }
            else
            {
                localFileAction = "update";
                updatedLocalAudioFiles++;
            }

            string fileLinkAction = FileLinkAction(
                targetRelease,
                digitalOwnedItem,
                localFile,
                includedTrack,
                outcome,
                context,
                collectionId);
            if (fileLinkAction == "create")
            {
                newDigitalTrackFileLinks++;
            }
            else if (fileLinkAction == "relink")
            {
                relinkedDigitalTrackFileLinks++;
            }
            else if (fileLinkAction == "unchanged")
            {
                unchangedDigitalTrackFileLinks++;
            }

            trackPlans.Add(new ReleaseImportConfirmationTrackPlanResponse(
                includedTrack.Id.Value,
                includedTrack.Title,
                includedTrack.Position,
                IsSkipped: false,
                includedTrack.SelectedTrackId?.Value,
                trackAction,
                localFileAction,
                fileLinkAction));
        }

        int reusedTracks = includedTracks.Count(track => track.SelectedTrackId.HasValue);
        int newTracks = includedTracks.Length - reusedTracks;
        var summary = new ReleaseImportConfirmationSummaryResponse(
            IncludedTrackCount: includedTracks.Length,
            SkippedTrackCount: skippedTracks.Length,
            DuplicateTrackCount: reusedTracks,
            NewReleases: outcome == "newRelease" ? 1 : 0,
            ReusedReleases: outcome == "exactDuplicate" ? 1 : 0,
            UpdatedReleases: outcome == "partialDuplicate" ? 1 : 0,
            NewTracks: newTracks,
            ReusedTracks: reusedTracks,
            NewDigitalOwnedItems: blockingErrors.Count == 0 && digitalOwnedItem is null ? 1 : 0,
            ReusedDigitalOwnedItems: digitalOwnedItem is null ? 0 : 1,
            NewLocalAudioFiles: newLocalAudioFiles,
            UpdatedLocalAudioFiles: updatedLocalAudioFiles,
            NewDigitalTrackFileLinks: newDigitalTrackFileLinks,
            RelinkedDigitalTrackFileLinks: relinkedDigitalTrackFileLinks,
            UnchangedDigitalTrackFileLinks: unchangedDigitalTrackFileLinks);

        return new ReleaseImportConfirmationPreflightResponse(
            session.Id.Value,
            draft.Id.Value,
            DraftStatusCode(draft.Status),
            CanConfirm: blockingErrors.Count == 0,
            outcome,
            summary,
            Actions(summary),
            [.. trackPlans.OrderBy(track => track.Position ?? 9999).ThenBy(track => track.Title)],
            Issues(draft, allTracks),
            blockingErrors);
    }

}
