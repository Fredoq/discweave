using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.ArtistRelations;

public static partial class ArtistRelationsEndpointRouteBuilderExtensions
{
    private static ArtistRelation CreateRelation(
        ArtistRelationRequest request,
        CollectionId collectionId,
        ArtistRelationId relationId,
        string relationType)
    {
        ArtistRelationPeriod? period = ArtistRelationMapper.CreatePeriod(request.StartYear, request.EndYear);

        return period is null
            ? ArtistRelation.Create(relationId, collectionId, new ArtistId(request.SourceArtistId), new ArtistId(request.TargetArtistId), relationType)
            : ArtistRelation.Create(relationId, collectionId, new ArtistId(request.SourceArtistId), new ArtistId(request.TargetArtistId), relationType, period);
    }

    private static string CreateIdentityKey(ArtistRelationRequest request, string relationType)
    {
        ArtistRelationPeriod? period = ArtistRelationMapper.CreatePeriod(request.StartYear, request.EndYear);
        var sourceArtistId = new ArtistId(request.SourceArtistId);
        var targetArtistId = new ArtistId(request.TargetArtistId);

        return period is null
            ? ArtistRelationIdentity.WithoutPeriod(sourceArtistId, targetArtistId, relationType).Value
            : ArtistRelationIdentity.FromPeriod(sourceArtistId, targetArtistId, relationType, period).Value;
    }

    private static async Task<bool> ArtistRelationExistsAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        string identityKey,
        ArtistRelationId? excludedRelationId,
        CancellationToken cancellationToken)
    {
        IQueryable<ArtistRelation> query = context.ArtistRelations
            .AsNoTracking()
            .Where(relation => relation.CollectionId == collectionId && EF.Property<string>(relation, "_identityKey") == identityKey);

        if (excludedRelationId is { } relationId)
        {
            query = query.Where(relation => relation.Id != relationId);
        }

        return await query.AnyAsync(cancellationToken);
    }
}
