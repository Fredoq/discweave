using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<IReadOnlyDictionary<TrackId, string>>
        LoadTrackArtistDisplaysAsync(
            IReadOnlyCollection<TrackId> requestedTrackIds,
            DiscWeaveDbContext context,
            CollectionId collectionId,
            CancellationToken cancellationToken)
    {
        TrackId[] trackIds = [.. requestedTrackIds.Distinct()];
        Credit[] trackCredits = await LoadTrackCreditsAsync(
            context,
            collectionId,
            trackIds,
            cancellationToken);
        Release[] releases = await LoadAppearanceReleasesAsync(
            context,
            collectionId,
            trackIds,
            cancellationToken);
        ReleaseId[] releaseIds =
        [
            .. releases
                .Select(release => release.Id)
                .Distinct()
        ];
        Credit[] releaseCredits = await LoadReleaseCreditsAsync(
            context,
            collectionId,
            releaseIds,
            cancellationToken);
        ArtistId[] artistIds =
        [
            .. trackCredits
                .Concat(releaseCredits)
                .Select(credit => credit.Contributor.ArtistId)
                .Distinct()
        ];
        Dictionary<ArtistId, Artist> artistsById =
            await LoadArtistsByIdAsync(
                context,
                collectionId,
                artistIds,
                cancellationToken);

        return trackIds.ToDictionary(
            trackId => trackId,
            trackId => TrackArtistDisplay(
                trackId,
                trackCredits,
                releases,
                releaseCredits,
                artistsById));
    }

    private static string TrackArtistDisplay(
        TrackId trackId,
        IReadOnlyList<Credit> trackCredits,
        IReadOnlyList<Release> releases,
        IReadOnlyList<Credit> releaseCredits,
        Dictionary<ArtistId, Artist> artistsById)
    {
        Credit[] directCredits =
        [
            .. trackCredits.Where(credit =>
                credit.Target is TrackCreditTarget target &&
                target.TrackId == trackId)
        ];
        string[] mainArtists =
        [
            .. directCredits
                .Where(credit =>
                    credit.Roles.Contains(
                        "mainArtist",
                        StringComparer.Ordinal))
                .Select(credit => ArtistName(credit, artistsById))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
        string[] creditArtists =
        [
            .. directCredits
                .Select(credit => ArtistName(credit, artistsById))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
        string[] releaseArtists =
        [
            .. releases
                .Where(release =>
                    release.Tracklist.Any(item =>
                        item.TrackId == trackId))
                .OrderBy(
                    release => release.Summary.Title,
                    StringComparer.OrdinalIgnoreCase)
                .ThenBy(release => release.Id.Value)
                .Select(release => release.IsVariousArtists
                    ? "Various Artists"
                    : FormatReleaseArtists(
                        [
                            .. releaseCredits.Where(credit =>
                                credit.Target is
                                    ReleaseCreditTarget target &&
                                target.ReleaseId == release.Id)
                        ],
                        artistsById))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
        string[] selected = mainArtists.Length > 0
            ? mainArtists
            : creditArtists.Length > 0
                ? creditArtists
                : releaseArtists;

        return selected.Length > 0
            ? string.Join(", ", selected)
            : "Unknown artist";
    }

    private static string ArtistName(
        Credit credit,
        Dictionary<ArtistId, Artist> artistsById)
    {
        return artistsById.TryGetValue(
            credit.Contributor.ArtistId,
            out Artist? artist)
            ? artist.Name
            : credit.Contributor.Name;
    }
}
