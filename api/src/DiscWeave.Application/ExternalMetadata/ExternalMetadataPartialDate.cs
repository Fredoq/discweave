namespace DiscWeave.Application.ExternalMetadata;

public abstract class ExternalMetadataPartialDate
{
    private ExternalMetadataPartialDate(
        int year,
        DateOnly earliestPossibleDate,
        DateOnly latestPossibleDate)
    {
        Year = year;
        EarliestPossibleDate = earliestPossibleDate;
        LatestPossibleDate = latestPossibleDate;
    }

    public int Year { get; }

    public DateOnly EarliestPossibleDate { get; }

    public DateOnly LatestPossibleDate { get; }

    public static YearOnly ForYear(int year)
    {
        ValidateYear(year);
        return YearOnly.Create(year);
    }

    public static YearMonth ForYearMonth(int year, int month)
    {
        ValidateYear(year);
        ArgumentOutOfRangeException.ThrowIfLessThan(month, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(month, 12);
        return YearMonth.Create(year, month);
    }

    public static FullDate ForDate(DateOnly value)
    {
        return FullDate.Create(value);
    }

    private static void ValidateYear(int year)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(year, 1);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(year, 9999);
    }

    public sealed class YearOnly : ExternalMetadataPartialDate
    {
        private YearOnly(int year)
            : base(
                year,
                new DateOnly(year, 1, 1),
                new DateOnly(year, 12, 31))
        {
        }

        internal static YearOnly Create(int year)
        {
            return new YearOnly(year);
        }
    }

    public sealed class YearMonth : ExternalMetadataPartialDate
    {
        private YearMonth(int year, int month)
            : base(
                year,
                new DateOnly(year, month, 1),
                new DateOnly(
                    year,
                    month,
                    DateTime.DaysInMonth(year, month)))
        {
            Month = month;
        }

        public int Month { get; }

        internal static YearMonth Create(int year, int month)
        {
            return new YearMonth(year, month);
        }
    }

    public sealed class FullDate : ExternalMetadataPartialDate
    {
        private FullDate(DateOnly value)
            : base(value.Year, value, value)
        {
            Month = value.Month;
            Day = value.Day;
            Value = value;
        }

        public int Month { get; }

        public int Day { get; }

        public DateOnly Value { get; }

        internal static FullDate Create(DateOnly value)
        {
            return new FullDate(value);
        }
    }
}
