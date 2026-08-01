namespace DiscWeave.Api.Features.ExternalMetadata;

public abstract record ExternalMetadataPartialDateResponse
{
    private ExternalMetadataPartialDateResponse(string kind, int year)
    {
        Kind = kind;
        Year = year;
    }

    public string Kind { get; }

    public int Year { get; }

    public sealed record YearOnly : ExternalMetadataPartialDateResponse
    {
        public YearOnly(int year)
            : base("year", year)
        {
        }
    }

    public sealed record YearMonth : ExternalMetadataPartialDateResponse
    {
        public YearMonth(int year, int month)
            : base("yearMonth", year)
        {
            Month = month;
        }

        public int Month { get; }
    }

    public sealed record FullDate : ExternalMetadataPartialDateResponse
    {
        public FullDate(int year, int month, int day)
            : base("fullDate", year)
        {
            Month = month;
            Day = day;
        }

        public int Month { get; }

        public int Day { get; }
    }
}
