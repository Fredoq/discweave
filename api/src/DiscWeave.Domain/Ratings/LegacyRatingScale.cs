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
        return legacyValue >= Maximum
            ? (Rating.Maximum, true)
            : (Math.Max(Rating.Minimum, legacyValue - 4), false);
    }
}
