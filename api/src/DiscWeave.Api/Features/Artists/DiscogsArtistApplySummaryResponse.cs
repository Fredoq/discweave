namespace DiscWeave.Api.Features.Artists;

public sealed record DiscogsArtistApplySummaryResponse(
    int CreatedMemberArtists,
    int ReusedMemberArtists,
    int CreatedMemberRelations);
