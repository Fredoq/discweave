using DiscWeave.Api.Features.Releases;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Exports;

public static partial class ExportsEndpointRouteBuilderExtensions
{
    private static ReleaseTracklistItemResponse ToReleaseTracklistItemResponse(
        ReleaseTrack releaseTrack,
        IReadOnlyDictionary<TrackId, Credit[]> trackCreditsByTrackId,
        IReadOnlyDictionary<ArtistId, Artist> artistsById,
        Dictionary<TrackId, Track> tracksById)
    {
        Track? track = null;
        Credit[] trackCredits = [];
        if (releaseTrack.TrackId is { } trackId)
        {
            _ = tracksById.TryGetValue(trackId, out track);
            trackCredits = trackCreditsByTrackId.GetValueOrDefault(trackId) ?? [];
        }

        IReadOnlyList<ReleaseArtistCreditResponse> artistCredits = track is null
            ? [.. releaseTrack.ArtistCredits.Select(credit => ToReleaseTrackArtistCreditResponse(credit, artistsById))]
            : [.. trackCredits.Select(credit => ToReleaseArtistCreditResponse(credit, artistsById))];

        return new ReleaseTracklistItemResponse(
            releaseTrack.TrackId?.Value,
            releaseTrack.IsReleaseOnly,
            track?.Title ?? OptionalString(releaseTrack.TitleOverride) ?? "Unknown track",
            releaseTrack.Position.Number,
            OptionalString(releaseTrack.Position.Disc),
            OptionalString(releaseTrack.Position.Side),
            track is null ? ToDurationSeconds(releaseTrack) : ToDurationSeconds(track),
            artistCredits,
            [],
            releaseTrack.Id.Value);
    }

    private static ReleaseArtistCreditResponse ToReleaseTrackArtistCreditResponse(
        ReleaseTrackArtistCredit credit,
        IReadOnlyDictionary<ArtistId, Artist> artistsById)
    {
        return new ReleaseArtistCreditResponse(
            credit.ArtistId.Value,
            artistsById.TryGetValue(credit.ArtistId, out Artist? artist) ? artist.Name : "Unknown artist",
            credit.Roles.Count > 0 ? credit.Roles[0] : "mainArtist",
            credit.Roles.Count > 0 ? credit.Roles : ["mainArtist"]);
    }
}
