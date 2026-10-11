using DiscWeave.Domain.SharedKernel.Errors;

namespace DiscWeave.Domain.Ratings;

public sealed record Rating
{
    private Rating(int value)
    {
        Value = value;
    }

    public const int Minimum = 1;

    public const int Maximum = 5;

    public int Value { get; }

    public static Rating FromValue(int value)
    {
        return value is < Minimum or > Maximum
            ? throw new DomainException("rating.out_of_range", "Rating must be between 1 and 5")
            : new Rating(value);
    }
}
