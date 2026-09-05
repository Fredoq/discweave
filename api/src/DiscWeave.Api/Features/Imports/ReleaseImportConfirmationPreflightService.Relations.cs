using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public static partial class ReleaseImportConfirmationPreflightService
{
    private static async Task AddRelationBlockingErrorsAsync( // NOSONAR: preflight needs all transaction and relation services.
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
                suggestion.Decision == ReleaseImportRelationSuggestionDecision.Accepted)
            .OrderBy(suggestion => suggestion.Id)
            .ToArrayAsync(cancellationToken);
        if (suggestions.Length == 0)
        {
            return;
        }

        var draftTracks =
            includedTracks.ToDictionary(track => track.Id);
        Dictionary<ReleaseImportDraftTrackId, TrackId>
            resolvedTrackIdsByDraftTrackId =
                CreatePreflightResolvedTrackMap(includedTracks);
        ReleaseImportConfirmationService.AcceptedTrackRelationBuildContext
            relationBuildContext = await ReleaseImportConfirmationService
                .CreateAcceptedTrackRelationBuildContextAsync(
                    context,
                    collectionId,
                    resolvedTrackIdsByDraftTrackId,
                    cancellationToken);
        Dictionary<ReleaseImportDraftTrackId, Track> ephemeralTracks = [];
        Dictionary<TrackId, Track?> existingTracks = [];
        List<TrackRelation> simulatedRelations = [];
        List<(Track Target, string RelationType)> bestEffortPromotions = [];
        try
        {
            foreach (ReleaseImportRelationSuggestion suggestion in suggestions.Where(
                         item => item.ApplicationMode !=
                             ReleaseImportRelationSuggestionApplicationMode.Required))
            {
                ReleaseImportRelationSuggestionPayload payload =
                    suggestion.ReviewedPayload;
                if (ReleaseImportConfirmationService
                    .TryBuildAcceptedTrackRelation(
                        payload,
                        relationBuildContext,
                        out TrackRelation bestEffortRelation,
                        out ImportReviewIssue? warning))
                {
                    _ = context.TrackRelations.Add(bestEffortRelation);
                    simulatedRelations.Add(bestEffortRelation);
                    Track target = await ResolvePreflightRelationTrackAsync(
                        context,
                        collectionId,
                        payload.Target ?? throw ReleaseImportConfirmationService.RequiredRelationTargetFailure(),
                        draftTracks,
                        ephemeralTracks,
                        existingTracks,
                        cancellationToken);
                    bestEffortPromotions.Add((target, bestEffortRelation.RelationType));
                    relationBuildContext.Register(bestEffortRelation);
                }
                else if (warning?.Code == "release_import_relation.duplicate")
                {
                    Track target = await ResolvePreflightRelationTrackAsync(
                        context,
                        collectionId,
                        payload.Target ?? throw ReleaseImportConfirmationService.RequiredRelationTargetFailure(),
                        draftTracks,
                        ephemeralTracks,
                        existingTracks,
                        cancellationToken);
                    bestEffortPromotions.Add((
                        target,
                        payload.RelationTypeCode ?? string.Empty));
                }
            }

            foreach (ReleaseImportRelationSuggestion suggestion in suggestions.Where(
                         item => item.ApplicationMode ==
                             ReleaseImportRelationSuggestionApplicationMode.Required))
            {
                ReleaseImportRelationSuggestionPayload payload =
                    suggestion.ReviewedPayload;
                try
                {
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
                        relationBuildContext.Register(simulatedRelation);
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

            foreach ((Track target, string relationType) in bestEffortPromotions)
            {
                _ = await assignmentService.PromoteTargetIfEligibleAsync(
                    context,
                    collectionId,
                    target,
                    relationType,
                    cancellationToken);
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

    private static Dictionary<ReleaseImportDraftTrackId, TrackId>
        CreatePreflightResolvedTrackMap(
            IReadOnlyCollection<ReleaseImportDraftTrack> includedTracks)
    {
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIds = [];
        foreach (ReleaseImportDraftTrack track in includedTracks)
        {
            if (track.TrackMode == ReleaseImportTrackMode.Create)
            {
                resolvedTrackIds[track.Id] = new TrackId(track.Id.Value);
            }
            else if (track.TrackMode == ReleaseImportTrackMode.Link &&
                track.SelectedTrackId is { } selectedTrackId)
            {
                resolvedTrackIds[track.Id] = selectedTrackId;
            }
        }

        return resolvedTrackIds;
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
}
