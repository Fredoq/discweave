using System.Net;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateEndpointTests
{
    [Fact(DisplayName = "Missing and foreign discovery sources return the same typed 404")]
    public async Task Missing_and_foreign_discovery_sources_return_the_same_typed_404()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient localClient = await host.CreateAuthenticatedClientAsync();
        Guid foreignTrackId = await host.SeedForeignTrackAsync(
            "Foreign Track");

        foreach (Guid trackId in new[] { Guid.NewGuid(), foreignTrackId })
        {
            using HttpResponseMessage response = await localClient.GetAsync(
                $"/api/tracks/{trackId:D}/original-candidates/local");
            using JsonDocument document = await ReadJsonAsync(response);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal(
                "track.not_found",
                document.RootElement.GetProperty("code").GetString());
        }
    }

    [Fact(DisplayName = "Original and stacked discovery sources return the same typed conflict")]
    public async Task Original_and_stacked_discovery_sources_return_the_same_typed_conflict()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid originalSourceId = await CreateTrackAsync(
            client,
            "Original Source");
        Guid stackedSourceId = await CreateTrackAsync(
            client,
            "Stacked Source");
        Guid rootId = await CreateTrackAsync(client, "Existing Root");
        await MarkOriginalAsync(client, originalSourceId, "Original Source");
        await MarkOriginalAsync(client, rootId, "Existing Root");
        await CreateRelationAsync(
            client,
            stackedSourceId,
            rootId,
            "versionOf");

        foreach (Guid trackId in new[] { originalSourceId, stackedSourceId })
        {
            using HttpResponseMessage response = await client.GetAsync(
                $"/api/tracks/{trackId:D}/original-candidates/local");
            using JsonDocument document = await ReadJsonAsync(response);

            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            Assert.Equal(
                "original_discovery.source_not_eligible",
                document.RootElement.GetProperty("code").GetString());
        }
    }

    [Theory(DisplayName = "Discovery reliability requires exactly one High candidate")]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(2, false)]
    public async Task Discovery_reliability_requires_exactly_one_High_candidate(
        int highCount,
        bool expectedReliable)
    {
        var sourceTrackId = new TrackId(Guid.NewGuid());
        LocalOriginalCandidate[] candidates =
        [
            .. Enumerable.Range(0, highCount)
                .Select(index => Candidate(
                    Guid.NewGuid(),
                    $"high-{index}",
                    OriginalCandidateConfidence.High,
                    selectable: true,
                    OriginalCandidateChronology.FromYear(
                        1980 + index,
                        complete: true)))
        ];
        var result = new LocalOriginalCandidateResult
        {
            Status = LocalOriginalCandidateStatus.Success,
            SourceTrackId = sourceTrackId,
            Candidates = candidates
        };
        await using ApiTestHost host = await CreateHostWithResultAsync(result);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument document = await DiscoverAsync(
            client,
            sourceTrackId.Value);

        Assert.Equal(
            expectedReliable,
            document.RootElement.GetProperty(
                "hasReliableLocalCandidate").GetBoolean());
    }

    [Fact(DisplayName = "Discovery candidates remain isolated to the current collection")]
    public async Task Discovery_candidates_remain_isolated_to_the_current_collection()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient localClient = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateTrackAsync(
            localClient,
            "Pulse (Remix)");
        Guid localCandidateId = await CreateTrackAsync(
            localClient,
            "Pulse");
        Guid foreignCandidateId = await host.SeedForeignTrackAsync(
            "Pulse");

        using JsonDocument document = await DiscoverAsync(
            localClient,
            sourceTrackId);

        Guid[] candidateIds =
        [
            .. document.RootElement.GetProperty("items")
                .EnumerateArray()
                .Select(item =>
                    item.GetProperty("localTrackId").GetGuid())
        ];
        Assert.Contains(localCandidateId, candidateIds);
        Assert.DoesNotContain(foreignCandidateId, candidateIds);
    }
}
