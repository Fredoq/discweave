using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    internal static async Task<AcceptedTrackRelationBuildContext>
        CreateAcceptedTrackRelationBuildContextAsync(
            DiscWeaveDbContext context,
            CollectionId collectionId,
            IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId>
                resolvedTrackIdsByDraftTrackId,
            CancellationToken cancellationToken)
    {
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
        TrackRelation[] existingRelations = await context.TrackRelations
            .AsNoTracking()
            .Where(relation => relation.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        TrackRelation[] currentRelations =
        [
            .. existingRelations,
            .. context.TrackRelations.Local
                .Where(relation => relation.CollectionId == collectionId)
        ];

        return new AcceptedTrackRelationBuildContext(
            collectionId,
            resolvedTrackIdsByDraftTrackId,
            activeRelationTypeCodes,
            currentRelations);
    }

    internal static bool TryBuildAcceptedTrackRelation(
        ReleaseImportRelationSuggestionPayload payload,
        AcceptedTrackRelationBuildContext context,
        out TrackRelation relation,
        out ImportReviewIssue? warning)
    {
        relation = null!;
        warning = null;
        if (!TryResolveRelationEndpoint(
            payload.Source,
            context.ResolvedTrackIdsByDraftTrackId,
            out TrackId sourceTrackId))
        {
            warning = ReleaseOnlyRelationWarning();
            return false;
        }

        if (payload.Target is null || string.IsNullOrWhiteSpace(payload.RelationTypeCode))
        {
            return false;
        }

        if (!context.ActiveRelationTypeCodes.Contains(payload.RelationTypeCode))
        {
            warning = new ImportReviewIssue(
                "release_import_relation.relation_type_inactive",
                "Accepted relation suggestion uses an inactive relation type and was skipped");
            return false;
        }

        if (!TryResolveRelationEndpoint(
            payload.Target,
            context.ResolvedTrackIdsByDraftTrackId,
            out TrackId targetTrackId))
        {
            warning = ReleaseOnlyRelationWarning();
            return false;
        }

        if (sourceTrackId == targetTrackId)
        {
            warning = new ImportReviewIssue(
                "release_import_relation.self_resolved",
                "Accepted relation suggestion resolved to the same track and was skipped");
            return false;
        }

        if (context.Contains(
            sourceTrackId,
            targetTrackId,
            payload.RelationTypeCode))
        {
            warning = new ImportReviewIssue(
                "release_import_relation.duplicate",
                "Accepted relation suggestion duplicated an existing track relation and was skipped");
            return false;
        }

        relation = TrackRelation.Create(
            TrackRelationId.New(),
            context.CollectionId,
            sourceTrackId,
            targetTrackId,
            payload.RelationTypeCode);
        return true;
    }

    private static bool TryResolveRelationEndpoint(
        ReleaseImportRelationSuggestionEndpoint endpoint,
        IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        out TrackId trackId)
    {
        switch (endpoint.Kind)
        {
            case ReleaseImportRelationSuggestionEndpointKind.ExistingTrack:
                trackId = new TrackId(endpoint.TrackId);
                return true;
            case ReleaseImportRelationSuggestionEndpointKind.DraftTrack:
                return resolvedTrackIdsByDraftTrackId.TryGetValue(
                    new ReleaseImportDraftTrackId(endpoint.TrackId),
                    out trackId);
            default:
                throw new DomainException(
                    "release_import_relation.endpoint_kind_invalid",
                    "Accepted relation suggestion endpoint kind is invalid");
        }
    }

    private static ImportReviewIssue ReleaseOnlyRelationWarning()
    {
        return new ImportReviewIssue(
            "release_import_relation.release_only",
            "Accepted relation suggestion references a release-only tracklist row and was skipped");
    }

    internal sealed class AcceptedTrackRelationBuildContext
    {
        private readonly HashSet<TrackRelationIdentity> _relationIdentities;

        public AcceptedTrackRelationBuildContext(
            CollectionId collectionId,
            IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId>
                resolvedTrackIdsByDraftTrackId,
            HashSet<string> activeRelationTypeCodes,
            IReadOnlyCollection<TrackRelation> currentRelations)
        {
            CollectionId = collectionId;
            ResolvedTrackIdsByDraftTrackId =
                resolvedTrackIdsByDraftTrackId;
            ActiveRelationTypeCodes = activeRelationTypeCodes;
            _relationIdentities =
            [
                .. currentRelations.Select(relation =>
                    new TrackRelationIdentity(
                        relation.SourceTrackId,
                        relation.TargetTrackId,
                        relation.RelationType))
            ];
        }

        public CollectionId CollectionId { get; }
        public IReadOnlyDictionary<ReleaseImportDraftTrackId, TrackId> ResolvedTrackIdsByDraftTrackId { get; }
        public HashSet<string> ActiveRelationTypeCodes { get; }

        public bool Contains(
            TrackId sourceTrackId,
            TrackId targetTrackId,
            string relationType)
        {
            return _relationIdentities.Contains(new TrackRelationIdentity(
                sourceTrackId,
                targetTrackId,
                relationType));
        }

        public void Register(TrackRelation relation)
        {
            _ = _relationIdentities.Add(new TrackRelationIdentity(
                relation.SourceTrackId,
                relation.TargetTrackId,
                relation.RelationType));
        }
    }

    private readonly record struct TrackRelationIdentity(
        TrackId SourceTrackId,
        TrackId TargetTrackId,
        string RelationType);
}
