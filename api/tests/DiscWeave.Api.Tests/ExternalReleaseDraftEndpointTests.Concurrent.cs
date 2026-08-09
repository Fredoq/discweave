using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace DiscWeave.Api.Tests;

public sealed partial class ExternalReleaseDraftEndpointTests
{
    [Fact]
    public async Task Concurrent_identical_idempotency_requests_return_the_same_session()
    {
        var releaseMbid = Guid.Parse("77777777-7777-7777-7777-777777777777");
        var recordingMbid = Guid.Parse("88888888-8888-8888-8888-888888888888");
        var trackMbid = Guid.Parse("99999999-9999-9999-9999-999999999999");
        var bothLookupsStarted = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        int lookupArrivals = 0;
        FakeExternalMetadataProvider musicBrainz = Provider("musicbrainz", releaseMbid, recordingMbid, trackMbid);
        musicBrainz.BeforeReleaseLookupAsync = async cancellationToken =>
        {
            if (Interlocked.Increment(ref lookupArrivals) <= 2)
            {
                if (lookupArrivals == 2)
                {
                    _ = bothLookupsStarted.TrySetResult(true);
                }

                _ = await bothLookupsStarted.Task.WaitAsync(cancellationToken);
            }
        };
        FakeExternalMetadataProvider discogs = new("discogs");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(
            _sqlite,
            services =>
            {
                _ = services.RemoveAll<ILocalOriginalCandidateService>();
                _ = services.AddSingleton<ILocalOriginalCandidateService>(new EligibleLocalCandidateService());
                FakeExternalMetadataProvider.Register(services, musicBrainz, discogs);
            });
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateSourceTrackAsync(client);
        var request = new
        {
            sourceTrackId,
            recordingMbid,
            musicBrainzRow = new { releaseMbid, mediumPosition = "1", trackMbid },
            reviewedRelationTypeCode = "remixOf",
            idempotencyKey = "external-draft-concurrent-replay"
        };

        Task<HttpResponseMessage> firstTask = client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            request);
        Task<HttpResponseMessage> secondTask = client.PostAsJsonAsync(
            "/api/imports/external-release-drafts",
            request);
        _ = await bothLookupsStarted.Task.WaitAsync(TimeSpan.FromSeconds(5));
        HttpResponseMessage[] responses = await Task.WhenAll(firstTask, secondTask);
        try
        {
            string[] payloads = await Task.WhenAll(
                responses.Select(response => response.Content.ReadAsStringAsync()));
            Assert.All(
                responses.Zip(payloads),
                pair => Assert.True(
                    pair.First.StatusCode == HttpStatusCode.Created,
                    $"{pair.First.StatusCode}: {pair.Second}"));
            using var firstDocument = JsonDocument.Parse(payloads[0]);
            using var secondDocument = JsonDocument.Parse(payloads[1]);
            Assert.Equal(
                firstDocument.RootElement.GetProperty("id").GetGuid(),
                secondDocument.RootElement.GetProperty("id").GetGuid());
            Assert.Equal(2, musicBrainz.ReleaseLookupCallCount);
        }
        finally
        {
            foreach (HttpResponseMessage response in responses)
            {
                response.Dispose();
            }
        }
    }
}
