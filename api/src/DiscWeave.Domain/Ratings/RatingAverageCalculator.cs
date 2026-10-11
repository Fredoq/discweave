using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Ratings;

/// <summary>
/// Computes the average track rating per criterion for releases, labels, and artists.
/// Each track counts once per target, unrated tracks are skipped, and a standout counts as the maximum rating.
/// </summary>
public static class RatingAverageCalculator
{
    public const string AliasOfRelationType = "aliasOf";
    public const string MemberOfRelationType = "memberOf";

    public static IReadOnlyList<RatingAverage> Calculate(RatingAverageSource source)
    {
        ArgumentNullException.ThrowIfNull(source);

        var releaseTracks = source.Releases
            .GroupBy(release => release.Id)
            .ToDictionary(group => group.Key, group => group.SelectMany(release => release.TrackIds).ToHashSet());
        var labelTracks = source.Releases
            .SelectMany(release => release.LabelIds.Select(labelId => (labelId, release.TrackIds)))
            .GroupBy(pair => pair.labelId)
            .ToDictionary(group => group.Key, group => group.SelectMany(pair => pair.TrackIds).ToHashSet());
        Dictionary<ArtistId, ArtistId[]> artistIdentities = ResolveArtistIdentities(source);
        List<RatingAverage> averages = [];

        foreach (RatingAverageCriterion criterion in source.Criteria)
        {
            var ratings = source.TrackRatings
                .Where(rating => rating.CriterionId == criterion.Id)
                .GroupBy(rating => rating.TrackId)
                .ToDictionary(group => group.Key, group => group.First().Value);
            if (ratings.Count == 0)
            {
                continue;
            }

            HashSet<string> roles = new(criterion.ArtistRoles, StringComparer.Ordinal);
            ILookup<ArtistId, TrackId> creditedTracks = source.TrackArtists
                .Where(credit => roles.Contains(credit.Role))
                .ToLookup(credit => credit.ArtistId, credit => credit.TrackId);

            averages.AddRange(Summarize(RatingTargetType.Release, criterion.Id, ratings, releaseTracks.Select(pair => (pair.Key.Value, pair.Value))));
            averages.AddRange(Summarize(RatingTargetType.Label, criterion.Id, ratings, labelTracks.Select(pair => (pair.Key.Value, pair.Value))));
            averages.AddRange(Summarize(
                RatingTargetType.Artist,
                criterion.Id,
                ratings,
                artistIdentities.Select(pair => (pair.Key.Value, pair.Value.SelectMany(identity => creditedTracks[identity]).ToHashSet()))));
        }

        return averages;
    }

    /// <summary>
    /// An artist answers for their own credits, their aliases, and the groups they or their aliases belong to.
    /// An alias or a group answers only for its own credits.
    /// </summary>
    private static Dictionary<ArtistId, ArtistId[]> ResolveArtistIdentities(RatingAverageSource source)
    {
        ILookup<ArtistId, ArtistId> aliasesByPrincipal = Links(source, AliasOfRelationType)
            .ToLookup(link => link.TargetArtistId, link => link.SourceArtistId);
        ILookup<ArtistId, ArtistId> groupsByMember = Links(source, MemberOfRelationType)
            .ToLookup(link => link.SourceArtistId, link => link.TargetArtistId);
        HashSet<ArtistId> aliases = [.. Links(source, AliasOfRelationType).Select(link => link.SourceArtistId)];

        return source.TrackArtists
            .Select(credit => credit.ArtistId)
            .Concat(source.ArtistLinks.SelectMany(link => new[] { link.SourceArtistId, link.TargetArtistId }))
            .Distinct()
            .ToDictionary(
                artistId => artistId,
                artistId =>
                {
                    if (aliases.Contains(artistId))
                    {
                        return [artistId];
                    }

                    ArtistId[] names = [artistId, .. aliasesByPrincipal[artistId]];
                    return (ArtistId[])[.. names.Concat(names.SelectMany(name => groupsByMember[name])).Distinct()];
                });
    }

    private static IEnumerable<RatingAverageArtistLink> Links(RatingAverageSource source, string type)
    {
        return source.ArtistLinks.Where(link => string.Equals(link.Type, type, StringComparison.Ordinal));
    }

    private static IEnumerable<RatingAverage> Summarize(
        RatingTargetType targetType,
        RatingCriterionId criterionId,
        Dictionary<TrackId, int> ratings,
        IEnumerable<(Guid TargetId, HashSet<TrackId> TrackIds)> targets)
    {
        foreach ((Guid targetId, HashSet<TrackId> trackIds) in targets)
        {
            int[] values = [.. trackIds.Where(ratings.ContainsKey).Select(trackId => ratings[trackId])];
            if (values.Length > 0)
            {
                yield return new RatingAverage(
                    targetType,
                    targetId,
                    criterionId,
                    decimal.Round(decimal.Divide(values.Sum(), values.Length), 2),
                    values.Length,
                    trackIds.Count);
            }
        }
    }
}
