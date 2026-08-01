using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzExternalMetadataProviderTests
{
    [Theory(DisplayName = "MusicBrainz release completeness requires present media tracks")]
    [InlineData("empty-media")]
    [InlineData("empty-tracks")]
    [InlineData("missing-tracks")]
    [InlineData("null-tracks")]
    public async Task MusicBrainz_release_completeness_requires_present_media_tracks(
        string vector)
    {
        string media = vector switch
        {
            "empty-media" => "[]",
            "empty-tracks" => /*lang=json,strict*/ """[{ "position": 1, "tracks": [] }]""",
            "missing-tracks" => /*lang=json,strict*/ """[{ "position": 1 }]""",
            "null-tracks" =>
                                     /*lang=json,strict*/
                                     """[{ "position": 1, "tracks": null }]""",
            _ => throw new ArgumentOutOfRangeException(
                nameof(vector))
        };
        string json =
            $$"""
              {
                "id": "10000000-0000-0000-0000-000000000001",
                "title": "Mapped Release",
                "date": "1980",
                "media": {{media}}
              }
              """;
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(json)));
        using var harness = new ProviderHarness(
            handler,
            ValidOptions());

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
            await harness.Provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery(
                    "10000000-0000-0000-0000-000000000001"),
                CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.TracklistComplete);
    }

    [Theory(DisplayName = "MusicBrainz release dates retain precision through the detail cache")]
    [InlineData("1980", "year", 1980, null, null)]
    [InlineData("1980-02", "yearMonth", 1980, 2, null)]
    [InlineData("1980-02-03", "fullDate", 1980, 2, 3)]
    [InlineData("1980-13", null, null, null, null)]
    public async Task MusicBrainz_release_dates_retain_precision_through_the_detail_cache(
        string date,
        string? expectedKind,
        int? expectedYear,
        int? expectedMonth,
        int? expectedDay)
    {
        string json = ReadFixture("release-detail.json")
            .Replace(
                "\"date\": \"1980-02-03\"",
                $"\"date\": \"{date}\"",
                StringComparison.Ordinal);
        var handler = new CapturingHandler(
            (_, _) => Task.FromResult(JsonResponse(json)));
        using var harness = new ProviderHarness(
            handler,
            ValidOptions());
        var query = new ExternalMetadataLookupQuery(
            "10000000-0000-0000-0000-000000000001");

        ExternalMetadataResult<ExternalMetadataReleaseDetail> first =
            await harness.Provider.GetReleaseAsync(
                query,
                CancellationToken.None);
        ExternalMetadataResult<ExternalMetadataReleaseDetail> second =
            await harness.Provider.GetReleaseAsync(
                query,
                CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Equal(1, handler.CallCount);
        AssertMusicBrainzDate(
            first.Value,
            expectedKind,
            expectedYear,
            expectedMonth,
            expectedDay);
        AssertMusicBrainzDate(
            second.Value,
            expectedKind,
            expectedYear,
            expectedMonth,
            expectedDay);
        Assert.Equal(first.Value.Year, second.Value.Year);
        Assert.Equal(
            first.Value.ReleaseDate,
            second.Value.ReleaseDate);
    }

    private static void AssertMusicBrainzDate(
        ExternalMetadataReleaseDetail detail,
        string? expectedKind,
        int? expectedYear,
        int? expectedMonth,
        int? expectedDay)
    {
        if (expectedKind is null)
        {
            _ = Assert.IsType<
                Domain.SharedKernel.Optional
                    .MissingOptionalValue<ExternalMetadataPartialDate>>(
                        detail.ReleaseDateEvidence);
            Assert.Null(detail.Year);
            Assert.Null(detail.ReleaseDate);
            return;
        }

        ExternalMetadataPartialDate date = Assert.IsType<
            Domain.SharedKernel.Optional
                .PresentOptionalValue<ExternalMetadataPartialDate>>(
                    detail.ReleaseDateEvidence).Value;
        Assert.Equal(expectedYear, date.Year);
        Assert.Equal(
            expectedMonth,
            date switch
            {
                ExternalMetadataPartialDate.YearMonth month =>
                    month.Month,
                ExternalMetadataPartialDate.FullDate fullMonth =>
                    fullMonth.Month,
                _ => null
            });
        Assert.Equal(
            expectedDay,
            date is ExternalMetadataPartialDate.FullDate fullDay
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
        Type expectedType = expectedKind switch
        {
            "year" => typeof(ExternalMetadataPartialDate.YearOnly),
            "yearMonth" => typeof(ExternalMetadataPartialDate.YearMonth),
            "fullDate" => typeof(ExternalMetadataPartialDate.FullDate),
            _ => throw new ArgumentOutOfRangeException(nameof(expectedKind)),
        };
        Assert.Equal(expectedType, date?.GetType());
    }
}
