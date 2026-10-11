namespace DiscWeave.Api.Features.Ratings;

public sealed record RatingValueRequest(int Value, bool? Standout = null);
