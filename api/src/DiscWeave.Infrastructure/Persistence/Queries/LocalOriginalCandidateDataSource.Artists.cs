using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Infrastructure.Persistence.Queries;

public sealed partial class LocalOriginalCandidateDataSource
{
    private static List<LocalOriginalCandidateSnapshot.PrimaryArtistFact>
        PrimaryArtists(
            CollectionId collectionId,
            IReadOnlyList<Track> tracks,
            IReadOnlyList<Release> releases,
            IReadOnlyList<Credit> credits,
            IReadOnlyDictionary<ArtistId, Artist> artistsById)
    {
        List<LocalOriginalCandidateSnapshot.PrimaryArtistFact> facts = [];
        foreach (TrackId trackId in tracks.OrderBy(item => item.Id.Value).Select(item => item.Id))
        {
            foreach (string name in PrimaryArtistNames(
                trackId,
                releases,
                credits,
                artistsById))
            {
                facts.Add(
                    new LocalOriginalCandidateSnapshot.PrimaryArtistFact
                    {
                        CollectionId = collectionId,
                        TrackId = trackId,
                        DisplayName = name
                    });
            }
        }

        return facts;
    }

    private static IReadOnlyList<string> PrimaryArtistNames(
        TrackId trackId,
        IReadOnlyList<Release> releases,
        IReadOnlyList<Credit> credits,
        IReadOnlyDictionary<ArtistId, Artist> artistsById)
    {
        Credit[] mainCredits =
        [
            .. credits
                .Where(credit =>
                    credit.Target is TrackCreditTarget target
                    && target.TrackId == trackId
                    && credit.Roles.Contains(
                        MainArtistRoleCode,
                        StringComparer.Ordinal))
                .OrderBy(credit => credit.Contributor.ArtistId.Value)
        ];
        if (mainCredits.Length > 0)
        {
            return DistinctNames(mainCredits, artistsById);
        }

        List<string> releaseNames = [];
        foreach (Release release in releases
            .Where(release => release.Tracklist.Any(item =>
                item.TrackId == trackId)
                && !release.IsVariousArtists)
            .OrderBy(
                release => release.Summary.Title,
                StringComparer.OrdinalIgnoreCase)
            .ThenBy(release => release.Id.Value))
        {
            Credit[] releaseCredits =
            [
                .. credits
                    .Where(credit =>
                        credit.Target is ReleaseCreditTarget target
                        && target.ReleaseId == release.Id
                        && credit.Roles.Contains(
                            MainArtistRoleCode,
                            StringComparer.Ordinal))
                    .OrderBy(credit => credit.Contributor.ArtistId.Value)
            ];
            releaseNames.AddRange(
                DistinctNames(releaseCredits, artistsById));
        }

        return
        [
            .. releaseNames
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
    }

    private static IReadOnlyList<string> DistinctNames(
        IEnumerable<Credit> credits,
        IReadOnlyDictionary<ArtistId, Artist> artistsById)
    {
        return
        [
            .. credits
                .Select(credit => ArtistName(credit, artistsById).Trim())
                .Where(name => name.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
        ];
    }
}
