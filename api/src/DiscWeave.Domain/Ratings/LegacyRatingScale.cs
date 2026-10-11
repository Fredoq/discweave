using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Domain.Ratings;

/// <summary>
/// Converts ratings from the retired ten-point scale to the five-point scale.
/// </summary>
public static class LegacyRatingScale
{
    public const int Maximum = 10;

    /// <summary>
    /// Maps 1-5 to 1, 6-9 to 2-5, and 10 to a standout 5.
    /// </summary>
    public static (int Value, bool IsStandout) Convert(int legacyValue)
    {
        return legacyValue switch
        {
            < Rating.Minimum or > Maximum => throw new DomainException("rating.out_of_range", "Legacy rating must be between 1 and 10"),
            Maximum => (Rating.Maximum, true),
            _ => (Math.Max(Rating.Minimum, legacyValue - 4), false)
        };
    }
}
