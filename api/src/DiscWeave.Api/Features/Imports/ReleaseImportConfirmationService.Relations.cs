using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
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
            .ToDictionary(track => track.Id, track => track.SelectedTrackId!.Value);
    }

    private static async Task<IReadOnlyList<ImportReviewIssue>> AddAcceptedTrackRelationsAsync(
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

        HashSet<string> activeRelationTypeCodes =
        [
            .. await context.CollectionDictionaryEntries.AsNoTracking()
                .Where(entry =>
                    entry.CollectionId == collectionId &&
                    entry.Kind == DictionaryKind.TrackRelationType &&
                    entry.IsActive)
                .Select(entry => entry.Code)
                .ToArrayAsync(cancellationToken)
        ];
        TrackRelation[] existingRelations = await context.TrackRelations.AsNoTracking()
            .Where(relation => relation.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        HashSet<TrackRelationIdentity> relationIdentities =
        [
            .. existingRelations.Select(relation => new TrackRelationIdentity(
                relation.SourceTrackId,
                relation.TargetTrackId,
                relation.RelationType)),
            .. context.TrackRelations.Local
                .Where(relation => relation.CollectionId == collectionId)
                .Select(relation => new TrackRelationIdentity(
                    relation.SourceTrackId,
                    relation.TargetTrackId,
                    relation.RelationType))
        ];

        List<ImportReviewIssue> warnings = [];
        foreach (ReleaseImportRelationSuggestion suggestion in acceptedSuggestions)
        {
            ReleaseImportRelationSuggestionPayload payload = suggestion.ReviewedPayload;
            TrackId sourceTrackId = ResolveRelationEndpoint(payload.Source, resolvedTrackIdsByDraftTrackId);
            if (payload.Target is null || string.IsNullOrWhiteSpace(payload.RelationTypeCode))
            {
                continue;
            }
            if (!activeRelationTypeCodes.Contains(payload.RelationTypeCode))
            {
                warnings.Add(new ImportReviewIssue(
                    "release_import_relation.relation_type_inactive",
                    "Accepted relation suggestion uses an inactive relation type and was skipped"));
                continue;
            }

            TrackId targetTrackId = ResolveRelationEndpoint(payload.Target, resolvedTrackIdsByDraftTrackId);
            if (sourceTrackId == targetTrackId)
            {
                warnings.Add(new ImportReviewIssue(
                    "release_import_relation.self_resolved",
                    "Accepted relation suggestion resolved to the same track and was skipped"));
                continue;
            }

            var relationIdentity = new TrackRelationIdentity(sourceTrackId, targetTrackId, payload.RelationTypeCode);
            if (relationIdentities.Contains(relationIdentity))
            {
                warnings.Add(new ImportReviewIssue(
                    "release_import_relation.duplicate",
                    "Accepted relation suggestion duplicated an existing track relation and was skipped"));
                continue;
            }

            _ = context.TrackRelations.Add(TrackRelation.Create(
                TrackRelationId.New(),
                collectionId,
                sourceTrackId,
                targetTrackId,
                payload.RelationTypeCode));
            _ = relationIdentities.Add(relationIdentity);
        }

        return warnings;
    }

    private static TrackId ResolveRelationEndpoint(
        ReleaseImportRelationSuggestionEndpoint endpoint,
        IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId)
    {
        return endpoint.Kind switch
        {
            ReleaseImportRelationSuggestionEndpointKind.ExistingTrack => new TrackId(endpoint.TrackId),
            ReleaseImportRelationSuggestionEndpointKind.DraftTrack => resolvedTrackIdsByDraftTrackId.TryGetValue(
                new ReleaseImportDraftTrackId(endpoint.TrackId),
                out TrackId trackId)
                ? trackId
                : throw new DomainException(
                    "release_import_relation.draft_track_unresolved",
                    "Accepted relation suggestion references an unresolved draft track"),
            _ => throw new DomainException(
                "release_import_relation.endpoint_kind_invalid",
                "Accepted relation suggestion endpoint kind is invalid")
        };
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
            draft.ExternalSources,
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

    private readonly record struct TrackRelationIdentity(TrackId SourceTrackId, TrackId TargetTrackId, string RelationType);
}
