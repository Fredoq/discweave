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
    private const string TrackRelationTypeInvalidCode =
        "track_relation.type_invalid";
    private const string TrackRelationTypeInvalidMessage =
        "Track relation type is invalid";

    private readonly TrackStackRelationValidator _validator;

    public TrackStackAssignmentService(
        TrackStackRelationValidator validator)
    {
        ArgumentNullException.ThrowIfNull(validator);

        _validator = validator;
    }

    public Task<TrackStackAssignmentResult> ValidateAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track source,
        Track target,
        string relationTypeCode,
        bool markTargetAsOriginal,
        CancellationToken cancellationToken)
    {
        return EvaluateAsync(
            context,
            collectionId,
            source,
            target,
            relationTypeCode,
            markTargetAsOriginal,
            assign: false,
            cancellationToken);
    }

    public Task<TrackStackAssignmentResult> AssignAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track source,
        Track target,
        string relationTypeCode,
        bool markTargetAsOriginal,
        CancellationToken cancellationToken)
    {
        return EvaluateAsync(
            context,
            collectionId,
            source,
            target,
            relationTypeCode,
            markTargetAsOriginal,
            assign: true,
            cancellationToken);
    }

    private async Task<TrackStackAssignmentResult> EvaluateAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track source,
        Track target,
        string relationTypeCode,
        bool markTargetAsOriginal,
        bool assign,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(source);
        ArgumentNullException.ThrowIfNull(target);
        ArgumentException.ThrowIfNullOrWhiteSpace(relationTypeCode);

        TrackStackAssignmentFailure scopeFailure =
            GetScopeFailure(collectionId, source, target);
        if (scopeFailure != TrackStackAssignmentFailure.None)
        {
            return Failure(scopeFailure);
        }

        IReadOnlyCollection<TrackRelation> currentRelations =
            await LoadCurrentRelationsAsync(
                context,
                collectionId,
                cancellationToken);
        TrackRelation? existing = FindIdenticalRelation(
            currentRelations,
            source.Id,
            target.Id,
            relationTypeCode);
        if (existing is not null)
        {
            return await CompleteExistingAsync(
                context,
                collectionId,
                target,
                existing,
                currentRelations,
                markTargetAsOriginal,
                assign,
                cancellationToken);
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
        TrackStackGraph graph = await LoadGraphAsync(
            context,
            collectionId,
            configuredTypeCodes,
            currentRelations,
            cancellationToken);
        TrackStackAssignmentFailure failure = MapFailure(
            _validator.ValidateNew(
                source,
                target,
                relationType,
                configuredTypeCodes,
                graph,
                markTargetAsOriginal));
        if (failure != TrackStackAssignmentFailure.None)
        {
            return Failure(failure);
        }

        if (!assign)
        {
            return Success(relation: null, wasCreated: true);
        }

        var relation = TrackRelation.Create(
            TrackRelationId.New(),
            collectionId,
            source.Id,
            target.Id,
            relationType);
        _ = context.TrackRelations.Add(relation);
        if (markTargetAsOriginal)
        {
            target.UpdateMetadata(
                target.Metadata.WithOriginalMarker(true));
        }

        return Success(relation, wasCreated: true);
    }

    private static TrackStackAssignmentFailure GetScopeFailure(
        CollectionId collectionId,
        Track source,
        Track target)
    {
        return true switch
        {
            _ when source.CollectionId != collectionId =>
                TrackStackAssignmentFailure.SourceCollectionMismatch,
            _ when target.CollectionId != collectionId =>
                TrackStackAssignmentFailure.TargetCollectionMismatch,
            _ when source.Id == target.Id =>
                TrackStackAssignmentFailure.SelfRelation,
            _ => TrackStackAssignmentFailure.None
        };
    }

    private static async Task<TrackStackAssignmentResult>
        CompleteExistingAsync(
            DiscWeaveDbContext context,
            CollectionId collectionId,
            Track target,
            TrackRelation existing,
            IReadOnlyCollection<TrackRelation> currentRelations,
            bool markTargetAsOriginal,
            bool assign,
            CancellationToken cancellationToken)
    {
        if (markTargetAsOriginal && !target.Metadata.IsOriginal)
        {
            IReadOnlyList<string> configuredTypeCodes =
                await TrackStackSettingsReader
                    .GetDefaultRelationTypeCodesAsync(
                        context,
                        collectionId,
                        cancellationToken);
            string existingIdentity = Identity(existing);
            bool targetHasAnotherStackRelation = currentRelations.Any(
                relation =>
                    configuredTypeCodes.Contains(
                        relation.RelationType) &&
                    !string.Equals(
                        Identity(relation),
                        existingIdentity,
                        StringComparison.Ordinal) &&
                    (relation.SourceTrackId == target.Id ||
                        relation.TargetTrackId == target.Id));
            if (targetHasAnotherStackRelation)
            {
                return Failure(
                    TrackStackAssignmentFailure.TargetNotStandalone);
            }

            if (assign)
            {
                target.UpdateMetadata(
                    target.Metadata.WithOriginalMarker(true));
            }
        }

        return Success(existing, wasCreated: false);
    }

}
