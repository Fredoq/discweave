using System.Net;
using System.Text.Json;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class ExternalMetadataReleaseEndpointTests
{
    [Theory(DisplayName = "Search candidates expose reliable date precision separately from unchecked dates")]
    [InlineData("fullDate", 1983, 3, 7, true)]
    [InlineData("yearMonth", 1983, 3, null, true)]
    [InlineData("year", 1983, null, null, true)]
    [InlineData(null, null, null, null, true)]
    [InlineData(null, null, null, null, false)]
    public async Task Search_candidates_expose_reliable_date_precision_separately_from_unchecked_dates(
        string? kind, int? year, int? month, int? day, bool isChecked)
    {
        var candidate = new ExternalMetadataReleaseCandidate(
            Source("release", "249504"), "New Order - Blue Monday", ["New Order"], 1983,
            ["Factory"], ["Vinyl"], "FAC 73", 1, [])
        {
            ReleaseDateEvidence = CreateEvidence(kind, year, month, day),
            DateEvidenceChecked = isChecked
        };
        var provider = new FakeExternalMetadataProvider
        {
            ReleaseSearchResult = new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
                new ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>([candidate], 1))
        };
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite, services => FakeExternalMetadataProvider.Register(services, provider));
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync("/api/external-metadata/discogs/releases?title=Blue%20Monday");
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        JsonElement item = document.RootElement.GetProperty("items")[0];
        Assert.Equal(isChecked, item.GetProperty("dateEvidenceChecked").GetBoolean());
        JsonElement date = item.GetProperty("releaseDateEvidence");
        if (kind is null)
        {
            Assert.Equal(JsonValueKind.Null, date.ValueKind);
        }
        else
        {
            Assert.Equal(kind, date.GetProperty("kind").GetString());
            Assert.Equal(year, date.GetProperty("year").GetInt32());
            Assert.Equal(month, date.TryGetProperty("month", out JsonElement monthValue) ? monthValue.GetInt32() : null);
            Assert.Equal(day, date.TryGetProperty("day", out JsonElement dayValue) ? dayValue.GetInt32() : null);
        }
    }
}
