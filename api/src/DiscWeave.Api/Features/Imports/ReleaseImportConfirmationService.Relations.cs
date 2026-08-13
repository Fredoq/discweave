using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static Dictionary<ReleaseImportDraftTrackId, TrackId> CreateSelectedTrackMap(
        IEnumerable<ReleaseImportDraftTrack> draftTracks)
    {
        return draftTracks
            .Where(track => track.SelectedTrackId.HasValue)
            .ToDictionary(track => track.Id, track => track.SelectedTrackId.GetValueOrDefault());
    }

    private async Task<IReadOnlyList<ImportReviewIssue>> AddAcceptedTrackRelationsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportDraft draft,
        IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        CancellationToken cancellationToken)
    {
        ReleaseImportRelationSuggestion[] acceptedSuggestions = await context.ReleaseImportRelationSuggestions.AsNoTracking()
            .Where(suggestion =>
                suggestion.CollectionId == collectionId &&
                suggestion.SessionId == sessionId &&
                suggestion.DraftId == draft.Id &&
                suggestion.Decision == ReleaseImportRelationSuggestionDecision.Accepted)
            .OrderBy(suggestion => suggestion.Id)
            .ToArrayAsync(cancellationToken);
        if (acceptedSuggestions.Length == 0)
        {
            return [];
        }

        AcceptedTrackRelationBuildContext relationBuildContext =
            await CreateAcceptedTrackRelationBuildContextAsync(
                context,
                collectionId,
                resolvedTrackIdsByDraftTrackId,
                cancellationToken);
        List<ImportReviewIssue> warnings = [];
        foreach (ReleaseImportRelationSuggestion suggestion in acceptedSuggestions)
        {
            ReleaseImportRelationSuggestionPayload payload = suggestion.ReviewedPayload;
            if (suggestion.ApplicationMode == ReleaseImportRelationSuggestionApplicationMode.Required)
            {
                TrackRelation requiredRelation = await ApplyRequiredTrackRelationAsync(
                    context,
                    collectionId,
                    payload,
                    resolvedTrackIdsByDraftTrackId,
                    cancellationToken);
                relationBuildContext.Register(requiredRelation);
                continue;
            }

            if (!TryBuildAcceptedTrackRelation(
                payload,
                relationBuildContext,
                out TrackRelation relation,
                out ImportReviewIssue? warning))
            {
                if (warning is not null)
                {
                    warnings.Add(warning);
                }

                continue;
            }

            _ = context.TrackRelations.Add(relation);
            relationBuildContext.Register(relation);
        }

        return warnings;
    }

    private async Task<TrackRelation> ApplyRequiredTrackRelationAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportRelationSuggestionPayload payload,
        IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        CancellationToken cancellationToken)
    {
        Track source = await ResolveRequiredRelationTrackAsync(
            context,
            collectionId,
            payload.Source,
            resolvedTrackIdsByDraftTrackId,
            cancellationToken);
        Track target = payload.Target is null
            ? throw RequiredRelationTargetFailure()
            : await ResolveRequiredRelationTrackAsync(
                context,
                collectionId,
                payload.Target,
                resolvedTrackIdsByDraftTrackId,
                cancellationToken);
        TrackStackAssignmentResult assignment = await _trackStackAssignmentService.AssignAsync(
            context,
            collectionId,
            source,
            target,
            payload.RelationTypeCode ?? string.Empty,
            markTargetAsOriginal: true,
            cancellationToken);
        return assignment.IsSuccess
            ? assignment.Relation ??
                throw new InvalidOperationException(
                    "A successful required relation assignment must return a relation")
            : throw RequiredRelationFailure(assignment.Failure);
    }

    private static async Task<Track> ResolveRequiredRelationTrackAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportRelationSuggestionEndpoint endpoint,
        IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        CancellationToken cancellationToken)
    {
        TrackId trackId;
        if (endpoint.Kind == ReleaseImportRelationSuggestionEndpointKind.ExistingTrack)
        {
            trackId = new TrackId(endpoint.TrackId);
        }
        else if (!resolvedTrackIdsByDraftTrackId.TryGetValue(
            new ReleaseImportDraftTrackId(endpoint.TrackId),
            out trackId))
        {
            throw RequiredRelationReleaseOnlyFailure();
        }

        return context.Tracks.Local.FirstOrDefault(
                track => track.CollectionId == collectionId && track.Id == trackId) ??
            await context.Tracks.SingleOrDefaultAsync(
                track => track.CollectionId == collectionId && track.Id == trackId,
                cancellationToken)
            ?? throw RequiredRelationTrackNotFoundFailure();
    }

    internal static DomainException RequiredRelationFailure(
        TrackStackAssignmentFailure failure)
    {
        return failure switch
        {
            TrackStackAssignmentFailure.SourceCollectionMismatch or
                TrackStackAssignmentFailure.TargetCollectionMismatch =>
                RequiredRelationTrackNotFoundFailure(),
            TrackStackAssignmentFailure.SelfRelation =>
                new DomainException(
                    "track_relation.stack_self_relation",
                    "Track relation cannot reference the same track twice"),
            TrackStackAssignmentFailure.RelationTypeNotConfigured =>
                new DomainException(
                    "track_relation.stack_type_invalid",
                    "Track relation type is not configured for track stacks"),
            TrackStackAssignmentFailure.Cycle =>
                new DomainException(
                    "track_relation.stack_cycle",
                    "Track relation would create a stack cycle"),
            TrackStackAssignmentFailure.SourceNotStandalone =>
                new DomainException(
                    "track_relation.stack_source_not_standalone",
                    "Source track is not standalone"),
            TrackStackAssignmentFailure.TargetNotOriginal =>
                new DomainException(
                    "track_relation.stack_target_not_original",
                    "Target track is not an original stack root"),
            TrackStackAssignmentFailure.TargetNotStandalone =>
                new DomainException(
                    "track_relation.stack_target_not_standalone",
                    "Target track already has stack members"),
            TrackStackAssignmentFailure.None =>
                throw new InvalidOperationException(
                    "A successful required relation validation cannot be mapped to an error"),
            _ => throw new ArgumentOutOfRangeException(
                nameof(failure),
                failure,
                "Unknown stack assignment failure")
        };
    }

    internal static DomainException RequiredRelationReleaseOnlyFailure()
    {
        return new DomainException(
            "release_import_relation.release_only",
            "Required relation suggestion references a release-only tracklist row");
    }

    internal static DomainException RequiredRelationTrackNotFoundFailure()
    {
        return new DomainException(
            "release_import_relation.track_not_found",
            "Required relation suggestion references a track that was not found");
    }

    internal static DomainException RequiredRelationTargetFailure()
    {
        return new DomainException(
            "release_import_relation.target_required",
            "Required relation suggestion target is required");
    }

    private static void AppendDraftIssues(ReleaseImportDraft draft, IReadOnlyList<ImportReviewIssue> issues)
    {
        if (issues.Count == 0)
        {
            return;
        }

        draft.UpdateEditableFields(new ReleaseImportDraftEditableFields(
            draft.Title,
            draft.Type,
            ToOptionalText(draft.CatalogNumber),
            ToOptionalText(draft.LabelName),
            ToOptionalDate(draft.ReleaseDate),
            ToOptionalInt(draft.Year),
            draft.IsVariousArtists,
            draft.NotOnLabel,
            ToOptionalText(draft.CoverPath),
            draft.ArtistNames,
            draft.ArtistCredits,
            draft.Labels,
            draft.SelectedArtistIds,
            draft.Genres,
            draft.Tags,
            draft.CreateCatalogTracks,
            [.. draft.Issues, .. issues]));
    }

    private static IOptionalValue<string> ToOptionalText(string? value)
    {
        return value is null ? Optional.Missing<string>() : Optional.From(value);
    }

    private static IOptionalValue<DateOnly> ToOptionalDate(DateOnly? value)
    {
        return value.HasValue ? Optional.From(value.Value) : Optional.Missing<DateOnly>();
    }

    private static IOptionalValue<int> ToOptionalInt(int? value)
    {
        return value.HasValue ? Optional.From(value.Value) : Optional.Missing<int>();
    }
}
