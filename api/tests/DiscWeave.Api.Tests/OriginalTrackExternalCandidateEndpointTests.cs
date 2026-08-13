using System.Net;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "External original discovery defaults a missing request body to MusicBrainz")]
    public async Task External_original_discovery_defaults_a_missing_request_body_to_MusicBrainz()
    {
        var sourceTrackId =
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var provider = new FakeRecordingLineageProvider();
        var result = new LocalOriginalCandidateResult
        {
            Status = LocalOriginalCandidateStatus.Success,
            SourceTrackId = new TrackId(sourceTrackId),
            Source = SourceFacts(sourceTrackId),
            Candidates = []
        };
        await using ApiTestHost host =
            await CreateHostWithResultAsync(result, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/tracks/{sourceTrackId:D}/original-candidates/external",
            content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, provider.CallCount);
        Assert.NotNull(provider.LastQuery);
        Assert.Equal("musicbrainz", provider.ProviderCode);
    }

    [Fact(DisplayName = "A reliable local original candidate returns the exact conflict")]
    public async Task A_reliable_local_original_candidate_returns_the_exact_conflict()
    {
        var sourceTrackId =
            Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var result = new LocalOriginalCandidateResult
        {
            Status = LocalOriginalCandidateStatus.Success,
            SourceTrackId = new TrackId(sourceTrackId),
            Source = SourceFacts(sourceTrackId),
            Candidates =
            [
                Candidate(
                    Guid.Parse("10000000-0000-0000-0000-000000000001"),
                    OriginalCandidateConfidence.High)
            ]
        };
        var provider = new FakeRecordingLineageProvider();
        await using ApiTestHost host =
            await CreateHostWithResultAsync(result, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/tracks/{sourceTrackId:D}/original-candidates/external",
            content: null);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        Assert.Equal(
            "original_discovery.local_candidate_available",
            document.RootElement.GetProperty("code").GetString());
        Assert.Equal(
            "A reliable local original candidate is available",
            document.RootElement.GetProperty("message").GetString());
        Assert.Equal(0, provider.CallCount);
    }
}
