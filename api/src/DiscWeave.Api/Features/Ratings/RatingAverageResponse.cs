namespace DiscWeave.Api.Features.Ratings;

public sealed record RatingAverageResponse(
    string TargetType,
    Guid TargetId,
    Guid CriterionId,
    decimal Average,
    int RatedTrackCount,
    int TrackCount);

public sealed record RatingAverageListResponse(IReadOnlyList<RatingAverageResponse> Items);
