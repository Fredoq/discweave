using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.ArtistRelations;

public static partial class ArtistRelationsEndpointRouteBuilderExtensions
{
    private const string AliasOfRelationType = "aliasOf";
    private const string AliasOfConflictCode = "artist_relation.alias_of_conflict";
    private const string AliasOfConflictMessage = "Artist can only have one Alias of relation";

    private static async Task EnsureAliasOfLimitAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ArtistId sourceArtistId,
        string relationType,
        ArtistRelationId? currentRelationId,
        CancellationToken cancellationToken)
    {
        if (relationType != AliasOfRelationType)
        {
            return;
        }

        bool existingAliasOf = await context.ArtistRelations.AnyAsync(
            relation =>
                relation.CollectionId == collectionId &&
                relation.SourceArtistId == sourceArtistId &&
                relation.Type == AliasOfRelationType &&
                relation.Id != currentRelationId,
            cancellationToken);

        if (existingAliasOf)
        {
            throw new DomainException(AliasOfConflictCode, AliasOfConflictMessage);
        }
    }
}
