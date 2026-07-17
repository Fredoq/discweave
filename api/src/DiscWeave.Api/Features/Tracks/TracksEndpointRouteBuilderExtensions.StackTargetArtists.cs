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
        ILookup<TrackId, Credit> trackCreditsByTrack = trackCredits
            .Where(credit => credit.Target is TrackCreditTarget)
            .ToLookup(credit =>
                ((TrackCreditTarget)credit.Target).TrackId);
        ILookup<TrackId, Release> releasesByTrack = releases
            .SelectMany(release =>
                release.Tracklist.Select(item => (item.TrackId, release)))
            .Where(entry => entry.TrackId.HasValue)
            .ToLookup(
                entry => entry.TrackId.GetValueOrDefault(),
                entry => entry.release);
        ILookup<ReleaseId, Credit> releaseCreditsByRelease = releaseCredits
            .Where(credit => credit.Target is ReleaseCreditTarget)
            .ToLookup(credit =>
                ((ReleaseCreditTarget)credit.Target).ReleaseId);

        return trackIds.ToDictionary(
            trackId => trackId,
            trackId => TrackArtistDisplay(
                trackId,
                trackCreditsByTrack,
                releasesByTrack,
                releaseCreditsByRelease,
                artistsById));
    }

    private static string TrackArtistDisplay(
        TrackId trackId,
        ILookup<TrackId, Credit> trackCreditsByTrack,
        ILookup<TrackId, Release> releasesByTrack,
        ILookup<ReleaseId, Credit> releaseCreditsByRelease,
        Dictionary<ArtistId, Artist> artistsById)
    {
        Credit[] directCredits = [.. trackCreditsByTrack[trackId]];
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
            .. releasesByTrack[trackId]
                .OrderBy(
                    release => release.Summary.Title,
                    StringComparer.OrdinalIgnoreCase)
                .ThenBy(release => release.Id.Value)
                .Select(release => release.IsVariousArtists
                    ? "Various Artists"
                    : FormatReleaseArtists(
                        [.. releaseCreditsByRelease[release.Id]],
                        artistsById))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
        string[] selected = releaseArtists;
        if (creditArtists.Length > 0)
        {
            selected = creditArtists;
        }

        if (mainArtists.Length > 0)
        {
            selected = mainArtists;
        }

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
