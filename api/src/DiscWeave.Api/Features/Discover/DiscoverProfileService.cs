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
        var examples = new List<DiscoverExample>();
        int ratedCount = 0;
        foreach (RatingValue rating in ratings)
        {
            (string title, string kind, string[] artists) = rating.Target switch
            {
                ReleaseRatingTarget target when releaseNames.TryGetValue(target.ReleaseId, out string? ratedReleaseTitle) =>
                    (ratedReleaseTitle, "release", ReleaseArtists(credits, target.ReleaseId)),
                TrackRatingTarget target when trackNames.TryGetValue(target.TrackId, out string? ratedTrackTitle) =>
                    (ratedTrackTitle, "track", TrackArtists(credits, rows, target.TrackId)),
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

        DiscoverContext? context = null;
        if (releaseId.HasValue && releaseNames.TryGetValue(new ReleaseId(releaseId.Value), out string? releaseTitle))
        {
            context = new DiscoverContext(ReleaseArtists(credits, new ReleaseId(releaseId.Value)).FirstOrDefault() ?? string.Empty, Limit(releaseTitle), "release");
        }
        else if (trackId.HasValue && trackNames.TryGetValue(new TrackId(trackId.Value), out string? trackTitle))
        {
            context = new DiscoverContext(TrackArtists(credits, rows, new TrackId(trackId.Value)).FirstOrDefault() ?? string.Empty, Limit(trackTitle), "track");
        }

        string token = _snapshots.Add(collectionId, selected, mode, context);
        DiscoverHistoryEntry[] history = await _history.ReadAsync(collectionId, cancellationToken);
        DiscoverLead[] avoid = [.. history.Where(entry => entry.Artist.Length > 0 && entry.Title.Length > 0)
            .OrderByDescending(entry => entry.At).Take(20).Select(entry => new DiscoverLead(entry.Artist, entry.Title))];
        return new DiscoverProfileResponse(token, selected, ratedCount, examples.Count > selected.Length, context, avoid);
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

    private static string[] ReleaseArtists(IEnumerable<Credit> credits, ReleaseId releaseId)
    {
        return [.. credits.Where(credit => credit.Target is ReleaseCreditTarget target && target.ReleaseId == releaseId && credit.Roles.Contains("mainArtist"))
            .Select(credit => Limit(credit.Contributor.Name)).Distinct(StringComparer.Ordinal)];
    }

    private static string[] TrackArtists(Credit[] credits, ReleaseTrack[] rows, TrackId trackId)
    {
        string[] artists = [.. credits.Where(credit => credit.Target is TrackCreditTarget target && target.TrackId == trackId &&
                (credit.Roles.Contains("mainArtist") || credit.Roles.Contains("remixer")))
            .Select(credit => Limit(credit.Contributor.Name)).Distinct(StringComparer.Ordinal)];
        return artists.Length > 0 ? artists : [.. rows.Where(row => row.TrackId == trackId)
            .SelectMany(row => ReleaseArtists(credits, row.ReleaseId)).Distinct(StringComparer.Ordinal)];
    }

    private static string Limit(string value) => value.Length > 200 ? value[..200] : value;

    private static string Hash(string seed, DiscoverExample example)
    {
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(seed + example.Artist + example.Title + example.Kind)));
    }
}
