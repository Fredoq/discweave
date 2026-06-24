using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Artists;

internal static class DiscogsArtistApplyWorkflow
{
    public const string MemberOfRelationType = "memberOf";

    public static bool IsDiscogsGroup(DiscogsArtistApplyRequest? request)
    {
        return request?.Members.Any(member => !string.IsNullOrWhiteSpace(member)) == true;
    }

    public static IReadOnlyList<ExternalSourceReferenceRequest> ExternalSourcesFromDiscogs(DiscogsArtistApplyRequest request)
    {
        return
        [
            new ExternalSourceReferenceRequest
            {
                ProviderName = request.Source.ProviderName,
                ResourceType = request.Source.ResourceType,
                ExternalId = request.Source.ExternalId,
                SourceUrl = request.Source.SourceUrl
            }
        ];
    }

    public static string TypeFromRequest(string? requestedType, DiscogsArtistApplyRequest? discogsArtist)
    {
        string normalizedType = RequiredType(requestedType);

        return IsDiscogsGroup(discogsArtist)
            ? "group"
            : normalizedType;
    }

    public static string RequiredType(string? type)
    {
        string normalizedType = type?.Trim() ?? string.Empty;

        return normalizedType is "person" or "group"
            ? normalizedType
            : throw new DomainException("artist.type_invalid", "Artist type is invalid");
    }

    public static async Task<DiscogsArtistApplySummaryResponse?> ApplyMembersAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Artist groupArtist,
        DiscogsArtistApplyRequest? request,
        CancellationToken cancellationToken)
    {
        if (request is null || !IsDiscogsGroup(request))
        {
            return null;
        }

        string[] memberNames = DistinctMemberNames(request);
        ArtistId[] existingRelationSourceIds = await context.ArtistRelations
            .Where(relation =>
                relation.CollectionId == collectionId &&
                relation.TargetArtistId == groupArtist.Id &&
                relation.Type == MemberOfRelationType)
            .Select(relation => relation.SourceArtistId)
            .ToArrayAsync(cancellationToken);
        HashSet<ArtistId> relatedMemberIds = [.. existingRelationSourceIds];

        int createdMemberArtists = 0;
        int reusedMemberArtists = 0;
        int createdMemberRelations = 0;

        foreach (string memberName in memberNames)
        {
            Artist? memberArtist = await context.Artists.FirstOrDefaultAsync(
                artist =>
                    artist.CollectionId == collectionId &&
                    EF.Functions.Collate(artist.Name, "NOCASE") == memberName,
                cancellationToken);

            if (memberArtist is null)
            {
                memberArtist = Person.Create(collectionId, ArtistId.New(), memberName);
                _ = context.Artists.Add(memberArtist);
                createdMemberArtists++;
            }
            else
            {
                reusedMemberArtists++;
            }

            if (memberArtist.Id == groupArtist.Id || relatedMemberIds.Contains(memberArtist.Id))
            {
                continue;
            }

            _ = context.ArtistRelations.Add(ArtistRelation.Create(
                ArtistRelationId.New(),
                collectionId,
                memberArtist.Id,
                groupArtist.Id,
                MemberOfRelationType));
            _ = relatedMemberIds.Add(memberArtist.Id);
            createdMemberRelations++;
        }

        return new DiscogsArtistApplySummaryResponse(
            createdMemberArtists,
            reusedMemberArtists,
            createdMemberRelations);
    }

    private static string[] DistinctMemberNames(DiscogsArtistApplyRequest request)
    {
        return
        [
            .. request.Members
                .Select(member => member.Trim())
                .Where(member => member.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
    }
}
