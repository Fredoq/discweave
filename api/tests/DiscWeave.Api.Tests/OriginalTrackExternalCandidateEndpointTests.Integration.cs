using System.Net;
using System.Text.Json;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalTrackExternalCandidateEndpointTests
{
    [Fact(DisplayName = "Missing and foreign sources return the same typed 404 before provider work")]
    public async Task Missing_and_foreign_sources_return_the_same_typed_404_before_provider_work()
    {
        var provider = new FakeRecordingLineageProvider();
        await using ApiTestHost host =
            await CreateHostWithProviderAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid foreignTrackId = await host.SeedForeignTrackAsync(
            "Foreign Source");

        foreach (Guid trackId in new[] { Guid.CreateVersion7(), foreignTrackId })
        {
            using HttpResponseMessage response = await client.PostAsync(
                $"/api/tracks/{trackId:D}/original-candidates/external",
                content: null);
            using JsonDocument document = await ReadJsonAsync(response);

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal(
                "track.not_found",
                document.RootElement.GetProperty("code").GetString());
        }

        Assert.Equal(0, provider.CallCount);
    }

    [Fact(DisplayName = "Ineligible sources return the existing typed conflict before provider work")]
    public async Task Ineligible_sources_return_the_existing_typed_conflict_before_provider_work()
    {
        var provider = new FakeRecordingLineageProvider();
        await using ApiTestHost host =
            await CreateHostWithProviderAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateCatalogTrackAsync(
            client,
            "Original Source");
        await MarkCatalogTrackOriginalAsync(
            client,
            sourceTrackId,
            "Original Source");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/tracks/{sourceTrackId:D}/original-candidates/external",
            content: null);
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(
            "original_discovery.source_not_eligible",
            document.RootElement.GetProperty("code").GetString());
        Assert.Equal(0, provider.CallCount);
    }

    [Fact(DisplayName = "External discovery performs no catalog or relation writes")]
    public async Task External_discovery_performs_no_catalog_or_relation_writes()
    {
        var selectedId = Guid.Parse(
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        var candidateId = Guid.Parse(
            "11111111-1111-1111-1111-111111111111");
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                LineageResult(
                    [
                        LineageCandidate(
                            candidateId,
                            [Relation(selectedId, candidateId)])
                    ],
                    RecordingSource(selectedId)))
        };
        await using ApiTestHost host =
            await CreateHostWithProviderAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateCatalogTrackAsync(
            client,
            "Blue Monday (Remix)");
        string trackBefore = await TrackPayloadAsync(client, sourceTrackId);
        int relationsBefore = await RelationCountAsync(client);

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/tracks/{sourceTrackId:D}/original-candidates/external",
            content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(
            trackBefore,
            await TrackPayloadAsync(client, sourceTrackId));
        Assert.Equal(relationsBefore, await RelationCountAsync(client));
        Assert.Equal(1, provider.CallCount);
    }

    [Fact(DisplayName = "External discovery local context remains collection isolated")]
    public async Task External_discovery_local_context_remains_collection_isolated()
    {
        var provider = new FakeRecordingLineageProvider();
        await using ApiTestHost host =
            await CreateHostWithProviderAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateCatalogTrackAsync(
            client,
            "Pulse (Remix)");
        Guid localCandidateId = await CreateCatalogTrackAsync(
            client,
            "Pulse");
        Guid foreignCandidateId = await host.SeedForeignTrackAsync("Pulse");

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/tracks/{sourceTrackId:D}/original-candidates/external",
            content: null);
        using JsonDocument document = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Guid[] localIds =
        [
            .. document.RootElement.GetProperty("local")
                .GetProperty("items")
                .EnumerateArray()
                .Select(item =>
                    item.GetProperty("localTrackId").GetGuid())
        ];
        Assert.Contains(localCandidateId, localIds);
        Assert.DoesNotContain(foreignCandidateId, localIds);
    }

    [Fact(DisplayName = "Provider messages and private data never enter the response")]
    public async Task Provider_messages_and_private_data_never_enter_the_response()
    {
        var provider = new FakeRecordingLineageProvider
        {
            Result = new ExternalMetadataResult<RecordingLineageResult>(
                new ExternalMetadataError(
                    ExternalMetadataErrorKind.Unavailable,
                    "musicbrainz.unavailable",
                    "secret-token collection-notes private-path"))
        };
        LocalOriginalCandidateResult local = EmptyLocalResult();
        await using ApiTestHost host =
            await CreateHostWithResultAsync(local, provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PostAsync(
            $"/api/tracks/{local.SourceTrackId.Value:D}/original-candidates/external",
            content: null);
        string payload = await response.Content.ReadAsStringAsync();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("secret-token", payload, StringComparison.Ordinal);
        Assert.DoesNotContain("collection-notes", payload, StringComparison.Ordinal);
        Assert.DoesNotContain("private-path", payload, StringComparison.Ordinal);
        using var document = JsonDocument.Parse(payload);
        JsonElement status = Assert.Single(
            document.RootElement.GetProperty("providerStatuses")
                .EnumerateArray());
        Assert.Equal(
            ["providerCode", "outcome", "errorCode", "retryAfter"],
            PropertyNames(status));
    }
}
