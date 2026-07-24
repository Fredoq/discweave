using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
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
        TrackStackAssignmentService assignmentService,
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
        EnsureLocalFileDescriptors(allTracks);
        ReleaseImportDraftTrack[] includedTracks = [.. allTracks.Where(track => !track.IsSkipped)];
        ReleaseImportDraftTrack[] skippedTracks = [.. allTracks.Where(track => track.IsSkipped)];
        List<ImportIssueResponse> blockingErrors = BlockingErrors(draft, includedTracks);
        await AddRelationBlockingErrorsAsync(
            context,
            collectionId,
            typedSessionId,
            typedDraftId,
            includedTracks,
            assignmentService,
            blockingErrors,
            cancellationToken);
        PreflightTarget target = await LoadPreflightTargetAsync(
            context,
            collectionId,
            draft,
            includedTracks,
            blockingErrors.Count > 0,
            cancellationToken);
        if (blockingErrors.Count > 0)
        {
            target = target with { ReviewOutcome = OutcomeBlocked };
        }
        TrackPlanBuildResult trackPlanBuild = await BuildTrackPlansAsync(
            context,
            collectionId,
            target,
            skippedTracks,
            includedTracks,
            cancellationToken);

        int reusedTracks = includedTracks.Count(track => track.TrackMode == ReleaseImportTrackMode.Link);
        int newTracks = includedTracks.Count(track => track.TrackMode == ReleaseImportTrackMode.Create);
        int releaseOnlyTracks = includedTracks.Count(track => track.TrackMode == ReleaseImportTrackMode.ReleaseOnly);
        ReleaseImportConfirmationSummaryResponse summary = Summary(new PreflightSummaryInputs(
            IncludedTrackCount: includedTracks.Length,
            SkippedTrackCount: skippedTracks.Length,
            ReusedTracks: reusedTracks,
            NewTracks: newTracks,
            ReleaseOnlyTracks: releaseOnlyTracks,
            IsBlocked: blockingErrors.Count > 0,
            Target: target,
            Counters: trackPlanBuild.Counters));

        return new ReleaseImportConfirmationPreflightResponse(
            draftContext.Session.Id.Value,
            draft.Id.Value,
            DraftStatusCode(draft.Status),
            CanConfirm: blockingErrors.Count == 0,
            target.ReviewOutcome,
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
        ReleaseImportDraftTrack[] tracks = await context.ReleaseImportDraftTracks
            .Where(track => track.CollectionId == collectionId && track.DraftId == draftId)
            .ToArrayAsync(cancellationToken);

        return
        [
            .. tracks
                .OrderBy(track => track.Position ?? 9999)
                .ThenBy(TrackOrderKey, StringComparer.Ordinal)
        ];
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
            return new PreflightTarget(
                OutcomeBlocked,
                null,
                null,
                draft.SourceKind == ReleaseImportSourceKind.LocalFiles);
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
        OwnedItem? digitalOwnedItem = targetRelease is null || draft.SourceKind != ReleaseImportSourceKind.LocalFiles
            ? null
            : await FindDigitalOwnedItemAsync(context, collectionId, targetRelease.Id, cancellationToken);

        return new PreflightTarget(
            Outcome(exactDuplicate, partialDuplicate, false),
            targetRelease,
            digitalOwnedItem,
            draft.SourceKind == ReleaseImportSourceKind.LocalFiles);
    }

    private static ReleaseImportConfirmationSummaryResponse Summary(PreflightSummaryInputs inputs)
    {
        return new ReleaseImportConfirmationSummaryResponse(
            IncludedTrackCount: inputs.IncludedTrackCount,
            SkippedTrackCount: inputs.SkippedTrackCount,
            DuplicateTrackCount: inputs.ReusedTracks,
            NewReleases: inputs.Target.ReviewOutcome == OutcomeNewRelease ? 1 : 0,
            ReusedReleases: inputs.Target.ReviewOutcome == OutcomeExactDuplicate ? 1 : 0,
            UpdatedReleases: inputs.Target.ReviewOutcome == OutcomePartialDuplicate ? 1 : 0,
            NewTracks: inputs.NewTracks,
            ReusedTracks: inputs.ReusedTracks,
            ReleaseOnlyTracks: inputs.ReleaseOnlyTracks,
            NewDigitalOwnedItems: inputs.Target.PlansLocalFileWork && !inputs.IsBlocked && inputs.Target.DigitalOwnedItem is null ? 1 : 0,
            ReusedDigitalOwnedItems: inputs.Target.PlansLocalFileWork && inputs.Target.DigitalOwnedItem is not null ? 1 : 0,
            NewLocalAudioFiles: inputs.Counters.NewLocalAudioFiles,
            UpdatedLocalAudioFiles: inputs.Counters.UpdatedLocalAudioFiles,
            NewDigitalTrackFileLinks: inputs.Counters.NewDigitalTrackFileLinks,
            RelinkedDigitalTrackFileLinks: inputs.Counters.RelinkedDigitalTrackFileLinks,
            UnchangedDigitalTrackFileLinks: inputs.Counters.UnchangedDigitalTrackFileLinks);
    }

    private sealed record PreflightDraftContext(ReleaseImportSession Session, ReleaseImportDraft Draft);

    private static void EnsureLocalFileDescriptors(IEnumerable<ReleaseImportDraftTrack> tracks)
    {
        foreach (ReleaseImportDraftTrack track in tracks.Where(track => track.SourceKind == ReleaseImportSourceKind.LocalFiles))
        {
            _ = RequiredLocalFile(track);
        }
    }

    private static string TrackOrderKey(ReleaseImportDraftTrack track)
    {
        return track.SourceKind == ReleaseImportSourceKind.LocalFiles
            ? RequiredLocalFile(track).RelativePath
            : track.Title;
    }

    private static ReleaseImportLocalFileDescriptor RequiredLocalFile(ReleaseImportDraftTrack track)
    {
        return track.LocalFile is PresentOptionalValue<ReleaseImportLocalFileDescriptor> localFile
            ? localFile.Value
            : throw new DomainException(
                "release_import.local_file_required",
                "Local file import track is missing its local file descriptor");
    }

    private sealed record PreflightTarget(
        string ReviewOutcome,
        Release? Release,
        OwnedItem? DigitalOwnedItem,
        bool PlansLocalFileWork);

    private sealed record PreflightSummaryInputs(
        int IncludedTrackCount,
        int SkippedTrackCount,
        int ReusedTracks,
        int NewTracks,
        int ReleaseOnlyTracks,
        bool IsBlocked,
        PreflightTarget Target,
        TrackPlanCounters Counters);

}
