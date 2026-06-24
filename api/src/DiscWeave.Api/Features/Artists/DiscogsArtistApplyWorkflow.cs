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
    public const string InvalidDiscogsArtistCode = "artist.discogs_artist_invalid";
    public const string InvalidDiscogsArtistMessage = "Discogs artist payload is invalid";

    public static bool IsDiscogsGroup(DiscogsArtistApplyRequest? request)
    {
        return request?.Members?.Any(member => !string.IsNullOrWhiteSpace(member)) == true;
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

    public static IReadOnlyList<ExternalSourceReferenceRequest> UpsertDiscogsExternalSources(
        IReadOnlyList<ExternalSourceReferenceRequest>? currentSources,
        DiscogsArtistApplyRequest request)
    {
        IReadOnlyList<ExternalSourceReferenceRequest> discogsSources = ExternalSourcesFromDiscogs(request);

        return
        [
            .. (currentSources ?? [])
                .Where(source => !discogsSources.Any(discogsSource => HasSameIdentity(source, discogsSource))),
            .. discogsSources
        ];
    }

    public static void ValidateDiscogsArtist(DiscogsArtistApplyRequest? request)
    {
        if (request is null)
        {
            return;
        }

        if (request.Source is null ||
            string.IsNullOrWhiteSpace(request.Source.ProviderName) ||
            string.IsNullOrWhiteSpace(request.Source.ResourceType) ||
            string.IsNullOrWhiteSpace(request.Source.ExternalId) ||
            string.IsNullOrWhiteSpace(request.Source.SourceUrl) ||
            string.IsNullOrWhiteSpace(request.Name) ||
            request.Aliases is null ||
            request.Members is null ||
            request.NameVariations is null)
        {
            throw new DomainException(InvalidDiscogsArtistCode, InvalidDiscogsArtistMessage);
        }
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

    private static bool HasSameIdentity(
        ExternalSourceReferenceRequest source,
        ExternalSourceReferenceRequest other)
    {
        return string.Equals(source.ProviderName, other.ProviderName, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(source.ResourceType, other.ResourceType, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(source.ExternalId, other.ExternalId, StringComparison.Ordinal);
    }
}
