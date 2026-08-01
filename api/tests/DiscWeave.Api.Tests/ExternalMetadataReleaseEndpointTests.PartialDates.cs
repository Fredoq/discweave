using System.Net;
using System.Text.Json;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Tests;

public sealed partial class ExternalMetadataReleaseEndpointTests
{
    [Theory(DisplayName = "Release detail preserves every partial date precision in the API contract")]
    [InlineData("year", 1983, null, null)]
    [InlineData("yearMonth", 1983, 3, null)]
    [InlineData("fullDate", 1983, 3, 7)]
    [InlineData(null, null, null, null)]
    public async Task Release_detail_preserves_every_partial_date_precision_in_the_Api_contract(
        string? kind,
        int? year,
        int? month,
        int? day)
    {
        IOptionalValue<ExternalMetadataPartialDate> evidence =
            CreateEvidence(kind, year, month, day);
        var provider = new FakeExternalMetadataProvider
        {
            ReleaseDetailResult =
                new ExternalMetadataResult<ExternalMetadataReleaseDetail>(
                    new ExternalMetadataReleaseDetail(
                        Source("release", "249504"),
                        "Blue Monday",
                        ["New Order"],
                        null,
                        null,
                        ["Factory"],
                        ["Vinyl"],
                        "single",
                        [],
                        [],
                        [],
                        "FAC 73",
                        [new ExternalMetadataReleaseLabel(
                            "Factory",
                            "FAC 73")],
                        [],
                        releaseDateEvidence: evidence,
                        tracklistComplete: true))
        };
        await using ApiTestHost host = await ApiTestHost.CreateAsync(
            sqlite,
            services => FakeExternalMetadataProvider.Register(
                services,
                provider));
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response =
            await client.GetAsync(
                "/api/external-metadata/discogs/releases/249504");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement root = document.RootElement;
        Assert.Equal(year, root.GetProperty("year").ValueKind ==
            JsonValueKind.Null
                ? null
                : root.GetProperty("year").GetInt32());
        JsonElement serialized = root.GetProperty(
            "releaseDateEvidence");
        if (kind is null)
        {
            Assert.Equal(JsonValueKind.Null, serialized.ValueKind);
        }
        else
        {
            Assert.Equal(
                kind,
                serialized.GetProperty("kind").GetString());
            Assert.Equal(year, serialized.GetProperty("year").GetInt32());
            Assert.Equal(
                month,
                serialized.TryGetProperty(
                    "month",
                    out JsonElement monthValue)
                        ? monthValue.GetInt32()
                        : null);
            Assert.Equal(
                day,
                serialized.TryGetProperty(
                    "day",
                    out JsonElement dayValue)
                        ? dayValue.GetInt32()
                        : null);
        }

        JsonElement draftDate = root.GetProperty("draft")
            .GetProperty("releaseDate");
        Assert.Equal(
            kind == "fullDate"
                ? "1983-03-07"
                : null,
            draftDate.ValueKind == JsonValueKind.Null
                ? null
                : draftDate.GetString());
    }

    private static IOptionalValue<ExternalMetadataPartialDate>
        CreateEvidence(
            string? kind,
            int? year,
            int? month,
            int? day)
    {
        return kind switch
        {
            "year" => Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForYear(year!.Value)),
            "yearMonth" => Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForYearMonth(
                    year!.Value,
                    month!.Value)),
            "fullDate" => Optional.From<ExternalMetadataPartialDate>(
                ExternalMetadataPartialDate.ForDate(
                    new DateOnly(
                        year!.Value,
                        month!.Value,
                        day!.Value))),
            null => Optional.Missing<ExternalMetadataPartialDate>(),
            _ => throw new ArgumentOutOfRangeException(nameof(kind))
        };
    }
}
