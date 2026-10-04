using DiscWeave.Api.Features.Settings;
using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using DiscWeave.Infrastructure.Persistence.Queries;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.TrackRelations;

public sealed partial class TrackStackAssignmentService
{
    // Re-rooting keeps the stack a relation-derived view with a single original:
    // the current original becomes a member of the new original, the original
    // marker moves, and the current original's direct members are re-attached
    // to the new original with their relation types unchanged.
    public static async Task<TrackStackAssignmentResult> PromoteOriginalAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track newOriginal,
        Track currentOriginal,
        string relationTypeCode,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(newOriginal);
        ArgumentNullException.ThrowIfNull(currentOriginal);
        ArgumentException.ThrowIfNullOrWhiteSpace(relationTypeCode);

        TrackStackAssignmentFailure scopeFailure =
            GetScopeFailure(collectionId, currentOriginal, newOriginal);
        if (scopeFailure != TrackStackAssignmentFailure.None)
        {
            return Failure(scopeFailure);
        }

        string relationType =
            await DictionaryValidation.RequireActiveCodeAsync(
                context,
                collectionId,
                DictionaryKind.TrackRelationType,
                relationTypeCode,
                TrackRelationTypeInvalidCode,
                TrackRelationTypeInvalidMessage,
                cancellationToken);
        IReadOnlyList<string> configuredTypeCodes =
            await TrackStackSettingsReader
                .GetDefaultRelationTypeCodesAsync(
                    context,
                    collectionId,
                    cancellationToken);
        if (!configuredTypeCodes.Contains(relationType, StringComparer.Ordinal))
        {
            return Failure(TrackStackAssignmentFailure.RelationTypeNotConfigured);
        }

        TrackStackGraph graph = await LoadGraphAsync(
            context,
            collectionId,
            configuredTypeCodes,
            await LoadCurrentRelationsAsync(context, collectionId, cancellationToken),
            cancellationToken);
        if (!currentOriginal.Metadata.IsOriginal || graph.IsMember(currentOriginal.Id))
        {
            return Failure(TrackStackAssignmentFailure.CurrentOriginalNotRoot);
        }

        bool isStackMember = graph.Project(currentOriginal).Members
            .Any(member => member.Track.Id == newOriginal.Id);
        if (!isStackMember && !graph.IsStandalone(newOriginal.Id))
        {
            return Failure(TrackStackAssignmentFailure.NewOriginalOutsideStack);
        }

        // A member's own outgoing stack links pointed toward the old original;
        // the new original has none. Its incoming members stay attached.
        string[] stackTypeCodes = [.. configuredTypeCodes];
        TrackRelation[] detachedRelations = await context.TrackRelations
            .Where(relation =>
                relation.CollectionId == collectionId &&
                relation.SourceTrackId == newOriginal.Id &&
                stackTypeCodes.Contains(relation.RelationType))
            .ToArrayAsync(cancellationToken);
        context.TrackRelations.RemoveRange(detachedRelations);

        TrackRelation[] currentMemberRelations = await context.TrackRelations
            .Where(relation =>
                relation.CollectionId == collectionId &&
                relation.TargetTrackId == currentOriginal.Id &&
                relation.SourceTrackId != newOriginal.Id &&
                stackTypeCodes.Contains(relation.RelationType))
            .ToArrayAsync(cancellationToken);
        TrackRelation[] existingNewOriginalRelations = await context.TrackRelations
            .Where(relation =>
                relation.CollectionId == collectionId &&
                relation.TargetTrackId == newOriginal.Id)
            .ToArrayAsync(cancellationToken);
        foreach (TrackRelation memberRelation in currentMemberRelations)
        {
            bool alreadyLinked = existingNewOriginalRelations.Any(existing =>
                existing.SourceTrackId == memberRelation.SourceTrackId &&
                string.Equals(existing.RelationType, memberRelation.RelationType, StringComparison.Ordinal));
            if (alreadyLinked)
            {
                _ = context.TrackRelations.Remove(memberRelation);
            }
            else
            {
                memberRelation.Update(memberRelation.SourceTrackId, newOriginal.Id, memberRelation.RelationType);
            }
        }

        var relation = TrackRelation.Create(
            TrackRelationId.New(),
            collectionId,
            currentOriginal.Id,
            newOriginal.Id,
            relationType);
        _ = context.TrackRelations.Add(relation);
        currentOriginal.UpdateMetadata(currentOriginal.Metadata.WithOriginalMarker(false));
        newOriginal.UpdateMetadata(newOriginal.Metadata.WithOriginalMarker(true));

        return Success(relation, wasCreated: true);
    }
}
