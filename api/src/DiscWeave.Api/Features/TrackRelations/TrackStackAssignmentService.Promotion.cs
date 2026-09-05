using DiscWeave.Application.Catalog.TrackStacks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using DiscWeave.Infrastructure.Persistence.Queries;

namespace DiscWeave.Api.Features.TrackRelations;

public sealed partial class TrackStackAssignmentService
{
    public async Task<bool> PromoteTargetIfEligibleAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Track target,
        string relationTypeCode,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(target);
        ArgumentException.ThrowIfNullOrWhiteSpace(relationTypeCode);

        if (target.Metadata.IsOriginal)
        {
            return false;
        }

        IReadOnlyList<string> configuredTypeCodes =
            await TrackStackSettingsReader.GetDefaultRelationTypeCodesAsync(
                context,
                collectionId,
                cancellationToken);
        if (!configuredTypeCodes.Contains(relationTypeCode, StringComparer.Ordinal))
        {
            return false;
        }

        IReadOnlyCollection<TrackRelation> currentRelations =
            await LoadCurrentRelationsAsync(context, collectionId, cancellationToken);
        TrackStackGraph graph = await LoadGraphAsync(
            context,
            collectionId,
            configuredTypeCodes,
            currentRelations,
            cancellationToken);
        if (graph.IsMember(target.Id))
        {
            return false;
        }

        target.UpdateMetadata(target.Metadata.WithOriginalMarker(true));
        return true;
    }
}
