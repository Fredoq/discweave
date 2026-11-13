using System.Net;
using System.Text.Json;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Theory(DisplayName = "Search reuses the matching detail response for exact date evidence without extra requests")]
    [InlineData("1983-03-07", "fullDate")]
    [InlineData("1983-03", "yearMonth")]
    [InlineData("1983", "year")]
    [InlineData(null, null)]
    [InlineData("1983-02-30", null)]
    public async Task Search_reuses_the_matching_detail_response_for_exact_date_evidence_without_extra_requests(string? released, string? expectedKind)
    {
        RecordingHttpMessageHandler handler = SearchDateHandler(released);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result = await provider.SearchReleasesAsync(new ExternalMetadataReleaseSearchQuery(Title: "Blue Monday"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(2, handler.Requests.Count);
        ExternalMetadataReleaseCandidate candidate = Assert.Single(result.Value.Items);
        Assert.True(candidate.DateEvidenceChecked);
        Assert.Equal(1983, candidate.Year);
        if (expectedKind is null)
        {
            Assert.False(candidate.ReleaseDateEvidence.HasValue);
        }
        else
        {
            ExternalMetadataPartialDate date = Assert.IsType<PresentOptionalValue<ExternalMetadataPartialDate>>(candidate.ReleaseDateEvidence).Value;
            Assert.Equal(1983, date.Year);
            switch (expectedKind)
            {
                case "fullDate":
                    Assert.Equal(new DateOnly(1983, 3, 7), Assert.IsType<ExternalMetadataPartialDate.FullDate>(date).Value);
                    break;
                case "yearMonth":
                    Assert.Equal(3, Assert.IsType<ExternalMetadataPartialDate.YearMonth>(date).Month);
                    break;
                default:
                    _ = Assert.IsType<ExternalMetadataPartialDate.YearOnly>(date);
                    break;
            }
        }
    }

    [Theory(DisplayName = "Unusable search detail does not fabricate date evidence from the search year")]
    [InlineData(404, 249504)]
    [InlineData(429, 249504)]
    [InlineData(200, 123)]
    public async Task Unusable_search_detail_does_not_fabricate_date_evidence_from_the_search_year(int status, long returnedId)
    {
        RecordingHttpMessageHandler handler = SearchDateHandler("1983-03-07", status, returnedId);
        DiscogsExternalMetadataProvider provider = CreateProvider(handler);

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result = await provider.SearchReleasesAsync(new ExternalMetadataReleaseSearchQuery(Title: "Blue Monday"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        ExternalMetadataReleaseCandidate candidate = Assert.Single(result.Value.Items);
        Assert.Equal(1983, candidate.Year);
        Assert.False(candidate.DateEvidenceChecked);
        Assert.False(candidate.ReleaseDateEvidence.HasValue);
        Assert.Equal(2, handler.Requests.Count);
    }

    private static RecordingHttpMessageHandler SearchDateHandler(string? released, int status = 200, long returnedId = 249504)
    {
        return new RecordingHttpMessageHandler(request => request.RequestUri?.AbsolutePath == "/database/search"
            ? new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(new
                {
                    pagination = new { items = 1 },
                    results = new[] { new { type = "release", id = 249504, title = "New Order - Blue Monday", year = 1983 } }
                }))
            }
            : new HttpResponseMessage((HttpStatusCode)status)
            {
                Content = new StringContent(JsonSerializer.Serialize(new { id = returnedId, title = "Blue Monday", released, tracklist = Array.Empty<object>() }))
            });
    }
}
