namespace DiscWeave.Api.Features.Artists;

public sealed record DiscogsArtistApplySummaryResponse(
    int CreatedMemberArtists,
    int ReusedMemberArtists,
    int CreatedMemberRelations,
    int CreatedAliasArtists,
    int ReusedAliasArtists,
    int CreatedAliasRelations)
{
    public static readonly DiscogsArtistApplySummaryResponse Empty = new(0, 0, 0, 0, 0, 0);

    public DiscogsArtistApplySummaryResponse Add(DiscogsArtistApplySummaryResponse other)
    {
        return new DiscogsArtistApplySummaryResponse(
            CreatedMemberArtists + other.CreatedMemberArtists,
            ReusedMemberArtists + other.ReusedMemberArtists,
            CreatedMemberRelations + other.CreatedMemberRelations,
            CreatedAliasArtists + other.CreatedAliasArtists,
            ReusedAliasArtists + other.ReusedAliasArtists,
            CreatedAliasRelations + other.CreatedAliasRelations);
    }
}
