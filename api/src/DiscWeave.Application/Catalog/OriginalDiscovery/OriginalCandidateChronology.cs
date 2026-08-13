namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record OriginalCandidateChronology
{
    public required DateOnly LowerBound { get; init; }
    public required DateOnly UpperBound { get; init; }
    public required OriginalCandidateDatePrecision Precision { get; init; }
    public required bool Complete { get; init; }

    public static OriginalCandidateChronology FromYear(int year, bool complete)
    {
        return new OriginalCandidateChronology
        {
            LowerBound = new DateOnly(year, 1, 1),
            UpperBound = new DateOnly(year, 12, 31),
            Precision = OriginalCandidateDatePrecision.Year,
            Complete = complete
        };
    }

    public static OriginalCandidateChronology FromMonth(int year, int month, bool complete)
    {
        return new OriginalCandidateChronology
        {
            LowerBound = new DateOnly(year, month, 1),
            UpperBound = new DateOnly(year, month, DateTime.DaysInMonth(year, month)),
            Precision = OriginalCandidateDatePrecision.Month,
            Complete = complete
        };
    }

    public static OriginalCandidateChronology FromDay(DateOnly day, bool complete)
    {
        return new OriginalCandidateChronology
        {
            LowerBound = day,
            UpperBound = day,
            Precision = OriginalCandidateDatePrecision.Day,
            Complete = complete
        };
    }
}
