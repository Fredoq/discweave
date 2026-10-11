using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;

namespace DiscWeave.Domain.Ratings;

public sealed class RatingValue : IEntity<RatingValueId>
{
    private const string ArtistTargetType = "artist";
    private const string LabelTargetType = "label";
    private const string ReleaseTargetType = "release";
    private const string TrackTargetType = "track";

    private string _targetType = string.Empty;
    private ArtistId? _targetArtistId;
    private ReleaseId? _targetReleaseId;
    private TrackId? _targetTrackId;
    private LabelId? _targetLabelId;

    private RatingValue()
    {
        Rating = Rating.FromValue(1);
    }

    private RatingValue(
        CollectionId collectionId,
        RatingValueId id,
        RatingCriterionId criterionId,
        RatingTarget target,
        Rating rating,
        bool isStandout)
    {
        CollectionId = collectionId;
        Id = id;
        CriterionId = criterionId;
        SetTarget(target);
        Rating = rating;
        UpdateRating(rating, isStandout);
    }

    public CollectionId CollectionId { get; private set; }

    public RatingValueId Id { get; private set; }

    public RatingCriterionId CriterionId { get; private set; }

    public RatingTarget Target => CreateTarget();

    public Rating Rating { get; private set; }

    /// <summary>
    /// Marks an exceptional target on top of the maximum rating.
    /// </summary>
    public bool IsStandout { get; private set; }

    public static RatingValue Create(
        CollectionId collectionId,
        RatingValueId id,
        RatingCriterionId criterionId,
        RatingTarget target,
        Rating rating,
        bool isStandout = false)
    {
        ArgumentNullException.ThrowIfNull(target);
        ArgumentNullException.ThrowIfNull(rating);

        return new RatingValue(collectionId, id, criterionId, target, rating, isStandout);
    }

    public void UpdateRating(Rating rating, bool isStandout = false)
    {
        ArgumentNullException.ThrowIfNull(rating);

        if (isStandout && rating.Value != Rating.Maximum)
        {
            throw new DomainException("rating.standout_requires_maximum", "Only the maximum rating can be marked as standout");
        }

        Rating = rating;
        IsStandout = isStandout;
    }

    private void SetTarget(RatingTarget target)
    {
        ArgumentNullException.ThrowIfNull(target);

        switch (target)
        {
            case ArtistRatingTarget artistTarget:
                _targetType = ArtistTargetType;
                _targetArtistId = artistTarget.ArtistId;
                _targetReleaseId = null;
                _targetTrackId = null;
                _targetLabelId = null;
                break;
            case ReleaseRatingTarget releaseTarget:
                _targetType = ReleaseTargetType;
                _targetArtistId = null;
                _targetReleaseId = releaseTarget.ReleaseId;
                _targetTrackId = null;
                _targetLabelId = null;
                break;
            case TrackRatingTarget trackTarget:
                _targetType = TrackTargetType;
                _targetArtistId = null;
                _targetReleaseId = null;
                _targetTrackId = trackTarget.TrackId;
                _targetLabelId = null;
                break;
            case LabelRatingTarget labelTarget:
                _targetType = LabelTargetType;
                _targetArtistId = null;
                _targetReleaseId = null;
                _targetTrackId = null;
                _targetLabelId = labelTarget.LabelId;
                break;
            default:
                throw new InvalidOperationException("Rating target type is not supported");
        }
    }

    private RatingTarget CreateTarget()
    {
        return _targetType switch
        {
            ArtistTargetType when _targetArtistId is { } artistId => RatingTarget.ForArtist(artistId),
            ReleaseTargetType when _targetReleaseId is { } releaseId => RatingTarget.ForRelease(releaseId),
            TrackTargetType when _targetTrackId is { } trackId => RatingTarget.ForTrack(trackId),
            LabelTargetType when _targetLabelId is { } labelId => RatingTarget.ForLabel(labelId),
            _ => throw new InvalidOperationException("Rating target payload is not valid")
        };
    }
}
