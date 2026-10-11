using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Ratings;

/// <summary>
/// Flat catalog facts needed to compute track-based rating averages.
/// </summary>
public sealed record RatingAverageSource(
    IReadOnlyCollection<RatingAverageCriterion> Criteria,
    IReadOnlyCollection<RatingAverageTrackRating> TrackRatings,
    IReadOnlyCollection<RatingAverageRelease> Releases,
    IReadOnlyCollection<RatingAverageTrackArtist> TrackArtists,
    IReadOnlyCollection<RatingAverageArtistLink> ArtistLinks);

public sealed record RatingAverageCriterion(RatingCriterionId Id, IReadOnlyCollection<string> ArtistRoles);

public sealed record RatingAverageTrackRating(RatingCriterionId CriterionId, TrackId TrackId, int Value);

public sealed record RatingAverageRelease(
    ReleaseId Id,
    IReadOnlyCollection<TrackId> TrackIds,
    IReadOnlyCollection<LabelId> LabelIds);

public sealed record RatingAverageTrackArtist(TrackId TrackId, ArtistId ArtistId, string Role);

/// <summary>
/// A directed artist relation: the source is an alias or a member of the target.
/// </summary>
public sealed record RatingAverageArtistLink(ArtistId SourceArtistId, ArtistId TargetArtistId, string Type);

public sealed record RatingAverage(
    RatingTargetType TargetType,
    Guid TargetId,
    RatingCriterionId CriterionId,
    decimal Average,
    int RatedTrackCount,
    int TrackCount);
