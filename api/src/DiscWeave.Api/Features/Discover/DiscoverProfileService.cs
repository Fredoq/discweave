using System.Security.Cryptography;
using System.Text;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Discover;

public sealed class DiscoverProfileService
{
    private readonly DiscWeaveDbContext _context;
    private readonly DiscoverSnapshots _snapshots;
    private readonly DiscoverHistoryStore _history;

    public DiscoverProfileService(DiscWeaveDbContext context, DiscoverSnapshots snapshots, DiscoverHistoryStore history)
    {
        _context = context;
        _snapshots = snapshots;
        _history = history;
    }

    public async Task<DiscoverProfileResponse?> CreateAsync(
        CollectionId collectionId, string seed, string mode, Guid? releaseId, Guid? trackId, CancellationToken cancellationToken)
    {
        if (!await ContextExistsAsync(collectionId, releaseId, trackId, cancellationToken))
        {
            return null;
        }

        RatingCriterionId[] criteria = await _context.RatingCriteria.AsNoTracking()
            .Where(criterion => criterion.CollectionId == collectionId && criterion.Code == RatingCriterionDefaults.OverallCode)
            .Select(criterion => criterion.Id).ToArrayAsync(cancellationToken);
        RatingValue[] ratings = await _context.RatingValues.AsNoTracking()
            .Where(rating => rating.CollectionId == collectionId && criteria.Contains(rating.CriterionId))
            .ToArrayAsync(cancellationToken);
        Release[] releases = await _context.Releases.AsNoTracking().Where(release => release.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        Track[] tracks = await _context.Tracks.AsNoTracking().Where(track => track.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        Credit[] credits = await _context.Credits.AsNoTracking().Where(credit => credit.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        ReleaseTrack[] rows = await _context.ReleaseTracks.AsNoTracking().Where(row => row.CollectionId == collectionId)
            .ToArrayAsync(cancellationToken);
        Dictionary<ReleaseId, string> releaseNames = releases.ToDictionary(release => release.Id, release => release.DisplayName);
        Dictionary<TrackId, string> trackNames = tracks.ToDictionary(track => track.Id, track => track.Title);
        Dictionary<ReleaseId, string[]> releaseArtists = ReleaseArtistIndex(credits);
        Dictionary<TrackId, string[]> trackArtists = TrackArtistIndex(credits, rows, releaseArtists);
        var examples = new List<DiscoverExample>();
        int ratedCount = 0;
        foreach (RatingValue rating in ratings)
        {
            (string title, string kind, string[] artists) = rating.Target switch
            {
                ReleaseRatingTarget target when releaseNames.TryGetValue(target.ReleaseId, out string? ratedReleaseTitle) =>
                    (ratedReleaseTitle, "release", releaseArtists.GetValueOrDefault(target.ReleaseId, [])),
                TrackRatingTarget target when trackNames.TryGetValue(target.TrackId, out string? ratedTrackTitle) =>
                    (ratedTrackTitle, "track", trackArtists.GetValueOrDefault(target.TrackId, [])),
                _ => (string.Empty, string.Empty, [])
            };
            if (title.Length > 0 && artists.Length > 0)
            {
                ratedCount++;
                foreach (string artist in artists.Take(3))
                {
                    examples.Add(new DiscoverExample(artist, Limit(title), kind, rating.Rating.Value, rating.IsStandout));
                }
            }
        }

        DiscoverExample[] selected = Sample(examples, seed);

        DiscoverContext? context = CreateContext(releaseId, trackId, releaseNames, trackNames, releaseArtists, trackArtists);

        string token = _snapshots.Add(collectionId, selected, mode, context);
        DiscoverHistoryEntry[] history = await _history.ReadAsync(collectionId, cancellationToken);
        DiscoverLead[] avoid = [.. history.Where(entry => entry.Artist.Length > 0 && entry.Title.Length > 0)
            .OrderByDescending(entry => entry.At).Take(20).Select(entry => new DiscoverLead(entry.Artist, entry.Title))];
        return new DiscoverProfileResponse(token, selected, ratedCount, examples.Count > selected.Length, context, avoid);
    }

    private static DiscoverContext? CreateContext(Guid? releaseId, Guid? trackId,
        Dictionary<ReleaseId, string> releaseNames, Dictionary<TrackId, string> trackNames,
        Dictionary<ReleaseId, string[]> releaseArtists, Dictionary<TrackId, string[]> trackArtists)
    {
        DiscoverContext? trackContext = trackId.HasValue && trackNames.TryGetValue(new TrackId(trackId.Value), out string? trackTitle)
            ? new DiscoverContext(trackArtists.GetValueOrDefault(new TrackId(trackId.Value), []).FirstOrDefault() ?? string.Empty, Limit(trackTitle), "track")
            : null;
        return releaseId.HasValue && releaseNames.TryGetValue(new ReleaseId(releaseId.Value), out string? releaseTitle)
            ? new DiscoverContext(releaseArtists.GetValueOrDefault(new ReleaseId(releaseId.Value), []).FirstOrDefault() ?? string.Empty, Limit(releaseTitle), "release")
            : trackContext;
    }

    public static DiscoverExample[] Sample(IEnumerable<DiscoverExample> examples, string seed)
    {
        // Each rating band gets a lane so low scores and smaller tastes survive a large collection.
        DiscoverExample[][] lanes = [.. examples.GroupBy(example => example.Rating)
            .OrderBy(group => group.Key)
            .Select(group => group.OrderBy(example => Hash(seed, example)).GroupBy(example => example.Artist)
                .SelectMany(grouping => grouping.Select((item, index) => (item, index)))
                .OrderBy(pair => pair.index).Select(pair => pair.item).ToArray())];
        var selected = new List<DiscoverExample>();
        for (int index = 0; selected.Count < 40 && lanes.Any(lane => index < lane.Length); index++)
        {
            foreach (DiscoverExample[] lane in lanes.Where(lane => index < lane.Length))
            {
                selected.Add(lane[index]);
                if (selected.Count == 40)
                {
                    break;
                }
            }
        }

        return [.. selected];
    }

    private async Task<bool> ContextExistsAsync(CollectionId collectionId, Guid? releaseId, Guid? trackId, CancellationToken cancellationToken)
    {
        return (!releaseId.HasValue || await _context.Releases.AnyAsync(release => release.CollectionId == collectionId && release.Id == new ReleaseId(releaseId.Value), cancellationToken)) &&
            (!trackId.HasValue || await _context.Tracks.AnyAsync(track => track.CollectionId == collectionId && track.Id == new TrackId(trackId.Value), cancellationToken));
    }

    internal static Dictionary<ReleaseId, string[]> ReleaseArtistIndex(IEnumerable<Credit> credits)
    {
        return credits.Where(credit => credit.Target is ReleaseCreditTarget && credit.Roles.Contains("mainArtist"))
            .GroupBy(credit => ((ReleaseCreditTarget)credit.Target).ReleaseId)
            .ToDictionary(group => group.Key,
                group => group.Select(credit => Limit(credit.Contributor.Name)).Distinct(StringComparer.Ordinal).ToArray());
    }

    internal static Dictionary<TrackId, string[]> TrackArtistIndex(IEnumerable<Credit> credits, IEnumerable<ReleaseTrack> rows,
        IReadOnlyDictionary<ReleaseId, string[]> releaseArtists)
    {
        var artists = credits.Where(credit => credit.Target is TrackCreditTarget &&
                (credit.Roles.Contains("mainArtist") || credit.Roles.Contains("remixer")))
            .GroupBy(credit => ((TrackCreditTarget)credit.Target).TrackId)
            .ToDictionary(group => group.Key,
                group => group.Select(credit => Limit(credit.Contributor.Name)).Distinct(StringComparer.Ordinal).ToArray());
        foreach (IGrouping<TrackId, ReleaseTrack> group in rows.Where(row => row.TrackId.HasValue).GroupBy(row => row.TrackId.GetValueOrDefault()))
        {
            if (!artists.ContainsKey(group.Key))
            {
                artists[group.Key] = [.. group.SelectMany(row => releaseArtists.GetValueOrDefault(row.ReleaseId, []))
                    .Distinct(StringComparer.Ordinal)];
            }
        }

        return artists;
    }

    private static string Limit(string value)
    {
        return value.Length > 200 ? value[..200] : value;
    }

    private static string Hash(string seed, DiscoverExample example)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(seed + example.Artist + example.Title + example.Kind)));
    }
}
