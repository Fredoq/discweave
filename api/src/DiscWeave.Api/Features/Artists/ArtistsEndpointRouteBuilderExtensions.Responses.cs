using DiscWeave.Api.Features.ExternalSources;
using DiscWeave.Application.Catalog.Artists;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Artists;

public static partial class ArtistsEndpointRouteBuilderExtensions
{
    private static Artist CreateArtist(CollectionId collectionId, string type, string name)
    {
        var artistId = ArtistId.New();

        return type switch
        {
            "person" => Person.Create(collectionId, artistId, name),
            "group" => Group.Create(collectionId, artistId, name),
            _ => throw new DomainException("artist.type_invalid", "Artist type is invalid")
        };
    }

    private static void MarkArtistForSearchDocumentRefresh(DiscWeaveDbContext context, Artist artist)
    {
        // The discriminator update uses raw SQL, so mark a stable scalar as modified
        // to run the existing collection-scoped search rebuild during SaveChanges.
        context.Entry(artist).Property(entity => entity.Name).IsModified = true;
    }

    private static ArtistResponse ToResponse(Artist artist, DiscogsArtistApplySummaryResponse? summary)
    {
        return ToResponse(artist, CurrentArtistType(artist), summary);
    }

    private static ArtistResponse ToResponse(
        Artist artist,
        string type,
        DiscogsArtistApplySummaryResponse? summary = null)
    {
        return !IsKnownArtistType(type)
            ? throw new InvalidOperationException("Artist type is not supported")
            : new ArtistResponse(
            artist.Id.Value,
            type,
            artist.Name,
            ExternalSourceReferenceMapper.ToResponses(artist.ExternalSources),
            summary);
    }

    private static ArtistResponse ToResponse(ArtistReadModel artist)
    {
        return new ArtistResponse(
            artist.Id.Value,
            artist.Type,
            artist.Name,
            ExternalSourceReferenceMapper.ToResponses(artist.ExternalSources));
    }

    private static bool IsKnownArtistType(string type)
    {
        return type is "person" or "group";
    }

    private static string CurrentArtistType(Artist artist)
    {
        return artist switch
        {
            Person => "person",
            Group => "group",
            _ => throw new InvalidOperationException("Artist type is not supported")
        };
    }
}
