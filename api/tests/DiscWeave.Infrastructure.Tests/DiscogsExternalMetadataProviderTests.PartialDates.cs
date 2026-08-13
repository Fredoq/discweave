using System.Globalization;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Theory(DisplayName = "Discogs release dates retain exact precision across refetch")]
    [InlineData(1983, null, "year", 1983, null, null)]
    [InlineData(null, "1983-03", "yearMonth", 1983, 3, null)]
    [InlineData(1983, "1983-03-07", "fullDate", 1983, 3, 7)]
    [InlineData(null, null, null, null, null, null)]
    [InlineData(1983, "invalid", null, null, null, null)]
    [InlineData(1983, "1984-03-07", null, null, null, null)]
    public async Task Discogs_release_dates_retain_exact_precision_across_refetch(
        int? year,
        string? released,
        string? expectedKind,
        int? expectedYear,
        int? expectedMonth,
        int? expectedDay)
    {
        string yearJson = year is null
            ? "null"
            : year.Value.ToString(CultureInfo.InvariantCulture);
        string releasedJson = released is null
            ? "null"
            : $"\"{released}\"";
        RecordingHttpMessageHandler handler = JsonHandler(
            $$"""
              {
                "id": 249504,
                "title": "Blue Monday",
                "uri": "/release/249504",
                "year": {{yearJson}},
                "released": {{releasedJson}},
                "tracklist": []
              }
              """);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataReleaseDetail> first =
            await provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("249504"),
                CancellationToken.None);
        ExternalMetadataResult<ExternalMetadataReleaseDetail> second =
            await provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("249504"),
                CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        AssertDate(
            first.Value,
            expectedKind,
            expectedYear,
            expectedMonth,
            expectedDay);
        AssertDate(
            second.Value,
            expectedKind,
            expectedYear,
            expectedMonth,
            expectedDay);
        Assert.Equal(first.Value.Year, second.Value.Year);
        Assert.Equal(first.Value.ReleaseDate, second.Value.ReleaseDate);
    }

    private static void AssertDate(
        ExternalMetadataReleaseDetail detail,
        string? expectedKind,
        int? expectedYear,
        int? expectedMonth,
        int? expectedDay)
    {
        if (expectedKind is null)
        {
            _ = Assert.IsType<
                MissingOptionalValue<ExternalMetadataPartialDate>>(
                detail.ReleaseDateEvidence);
            Assert.Null(detail.Year);
            Assert.Null(detail.ReleaseDate);
            return;
        }

        ExternalMetadataPartialDate date = Assert.IsType<
            PresentOptionalValue<ExternalMetadataPartialDate>>(
                detail.ReleaseDateEvidence).Value;
        Assert.Equal(expectedYear, date.Year);
        Assert.Equal(expectedMonth, date switch
        {
            ExternalMetadataPartialDate.YearMonth month =>
                month.Month,
            ExternalMetadataPartialDate.FullDate fullDate =>
                fullDate.Month,
            _ => null
        });
        Assert.Equal(expectedDay, date is
            ExternalMetadataPartialDate.FullDate fullDay
                ? fullDay.Day
                : null);
        Assert.Equal(
            expectedKind == "fullDate"
                ? new DateOnly(
                    expectedYear!.Value,
                    expectedMonth!.Value,
                    expectedDay!.Value)
                : null,
            detail.ReleaseDate);
    }
}
