using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Relations;
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
        await AddRequiredRelationBlockingErrorsAsync(
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

    private static async Task AddRequiredRelationBlockingErrorsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraftId draftId,
        IReadOnlyCollection<ReleaseImportDraftTrack> includedTracks,
        TrackStackAssignmentService assignmentService,
        List<ImportIssueResponse> blockingErrors,
        CancellationToken cancellationToken)
    {
        ReleaseImportRelationSuggestion[] suggestions = await context.ReleaseImportRelationSuggestions
            .AsNoTracking()
            .Where(suggestion =>
                suggestion.CollectionId == collectionId &&
                suggestion.SessionId == sessionId &&
                suggestion.DraftId == draftId &&
                suggestion.Decision == ReleaseImportRelationSuggestionDecision.Accepted &&
                suggestion.ApplicationMode == ReleaseImportRelationSuggestionApplicationMode.Required)
            .OrderBy(suggestion => suggestion.Id)
            .ToArrayAsync(cancellationToken);
        if (suggestions.Length == 0)
        {
            return;
        }

        var draftTracks =
            includedTracks.ToDictionary(track => track.Id);
        Dictionary<ReleaseImportDraftTrackId, Track> ephemeralTracks = [];
        Dictionary<TrackId, Track?> existingTracks = [];
        List<TrackRelation> simulatedRelations = [];
        try
        {
            foreach (ReleaseImportRelationSuggestion suggestion in suggestions)
            {
                try
                {
                    ReleaseImportRelationSuggestionPayload payload = suggestion.ReviewedPayload;
                    Track source = await ResolvePreflightRelationTrackAsync(
                        context,
                        collectionId,
                        payload.Source,
                        draftTracks,
                        ephemeralTracks,
                        existingTracks,
                        cancellationToken);
                    Track target = payload.Target is null
                        ? throw ReleaseImportConfirmationService.RequiredRelationTargetFailure()
                        : await ResolvePreflightRelationTrackAsync(
                            context,
                            collectionId,
                            payload.Target,
                            draftTracks,
                            ephemeralTracks,
                            existingTracks,
                            cancellationToken);
                    string relationTypeCode = payload.RelationTypeCode ?? string.Empty;
                    TrackStackAssignmentResult validation = await assignmentService.ValidateAsync(
                        context,
                        collectionId,
                        source,
                        target,
                        relationTypeCode,
                        markTargetAsOriginal: true,
                        cancellationToken);
                    if (!validation.IsSuccess)
                    {
                        throw ReleaseImportConfirmationService.RequiredRelationFailure(validation.Failure);
                    }

                    if (validation.WasCreated)
                    {
                        var simulatedRelation = TrackRelation.Create(
                            TrackRelationId.New(),
                            collectionId,
                            source.Id,
                            target.Id,
                            relationTypeCode);
                        _ = context.TrackRelations.Add(simulatedRelation);
                        simulatedRelations.Add(simulatedRelation);
                    }
                }
                catch (DomainException exception)
                {
                    blockingErrors.Add(new ImportIssueResponse(
                        exception.Code,
                        exception.Message,
                        IssueSeverityError));
                }
            }
        }
        finally
        {
            foreach (TrackRelation simulatedRelation in simulatedRelations)
            {
                context.Entry(simulatedRelation).State = EntityState.Detached;
            }

            foreach (Track ephemeralTrack in ephemeralTracks.Values)
            {
                context.Entry(ephemeralTrack).State = EntityState.Detached;
            }
        }
    }

    private static async Task<Track> ResolvePreflightRelationTrackAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportRelationSuggestionEndpoint endpoint,
        Dictionary<ReleaseImportDraftTrackId, ReleaseImportDraftTrack> draftTracks,
        Dictionary<ReleaseImportDraftTrackId, Track> ephemeralTracks,
        Dictionary<TrackId, Track?> existingTracks,
        CancellationToken cancellationToken)
    {
        if (endpoint.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack)
        {
            var existingTrackId = new TrackId(endpoint.TrackId);
            if (!existingTracks.TryGetValue(existingTrackId, out Track? existingTrack))
            {
                existingTrack = await context.Tracks
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        track => track.CollectionId == collectionId && track.Id == existingTrackId,
                        cancellationToken);
                existingTracks[existingTrackId] = existingTrack;
            }

            return existingTrack ?? throw ReleaseImportConfirmationService.RequiredRelationTrackNotFoundFailure();
        }

        var draftTrackId = new ReleaseImportDraftTrackId(endpoint.TrackId);
        if (!draftTracks.TryGetValue(draftTrackId, out ReleaseImportDraftTrack? draftTrack) ||
            draftTrack.TrackMode == ReleaseImportTrackMode.ReleaseOnly)
        {
            throw ReleaseImportConfirmationService.RequiredRelationReleaseOnlyFailure();
        }

        if (draftTrack.TrackMode == ReleaseImportTrackMode.Link)
        {
            if (draftTrack.SelectedTrackId is not { } selectedTrackId)
            {
                throw ReleaseImportConfirmationService.RequiredRelationTrackNotFoundFailure();
            }

            if (!existingTracks.TryGetValue(selectedTrackId, out Track? linkedTrack))
            {
                linkedTrack = await context.Tracks
                    .AsNoTracking()
                    .SingleOrDefaultAsync(
                        track => track.CollectionId == collectionId && track.Id == selectedTrackId,
                        cancellationToken);
                existingTracks[selectedTrackId] = linkedTrack;
            }

            return linkedTrack ?? throw ReleaseImportConfirmationService.RequiredRelationTrackNotFoundFailure();
        }

        if (!ephemeralTracks.TryGetValue(draftTrackId, out Track? ephemeralTrack))
        {
            ephemeralTrack = Track.Create(collectionId, new TrackId(draftTrack.Id.Value), draftTrack.Title);
            ephemeralTracks[draftTrackId] = ephemeralTrack;
            _ = context.Attach(ephemeralTrack);
        }

        return ephemeralTrack;
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
