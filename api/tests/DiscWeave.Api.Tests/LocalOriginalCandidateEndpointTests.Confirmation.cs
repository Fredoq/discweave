using System.Net;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class LocalOriginalCandidateEndpointTests
{
    [Fact(DisplayName = "Discovered existing roots confirm without promotion")]
    public async Task Discovered_existing_roots_confirm_without_promotion()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateTrackAsync(
            client,
            "Pulse (Remix)",
            durationSeconds: 300);
        Guid rootTrackId = await CreateTrackAsync(
            client,
            "Pulse",
            durationSeconds: 300);
        Guid memberTrackId = await CreateTrackAsync(
            client,
            "Pulse (Edit)");
        await MarkOriginalAsync(client, rootTrackId, "Pulse");
        Guid artistId = await CreateArtistAsync(client, "Candidate Artist");
        await AddMainArtistAsync(client, sourceTrackId, artistId);
        await AddMainArtistAsync(client, rootTrackId, artistId);
        await CreateRelationAsync(
            client,
            memberTrackId,
            rootTrackId,
            "versionOf");

        using JsonDocument discovery = await DiscoverAsync(
            client,
            sourceTrackId);
        JsonElement candidate = FindCandidate(discovery, rootTrackId);

        Assert.Equal(
            rootTrackId.ToString("D").ToLowerInvariant(),
            candidate.GetProperty("candidateKey").GetString());
        Assert.Equal("medium", candidate.GetProperty("confidence").GetString());
        Assert.True(candidate.GetProperty("selectable").GetBoolean());
        Assert.True(candidate.GetProperty("isExistingRoot").GetBoolean());
        Assert.Equal(1, candidate.GetProperty("memberCount").GetInt32());
        Assert.False(
            candidate.GetProperty("requiresPromotion").GetBoolean());
        Assert.Equal(
            "remixOf",
            candidate.GetProperty("suggestedRelationTypeCode").GetString());

        using HttpResponseMessage response = await ConfirmAsync(
            client,
            sourceTrackId,
            candidate);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(await IsOriginalAsync(client, rootTrackId));
        Assert.Equal(2, await RelationCountAsync(client));
    }

    [Fact(DisplayName = "Discovered standalone candidates confirm with atomic promotion")]
    public async Task Discovered_standalone_candidates_confirm_with_atomic_promotion()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateTrackAsync(
            client,
            "Pulse (Remix)",
            durationSeconds: 300);
        Guid targetTrackId = await CreateTrackAsync(
            client,
            "Pulse",
            durationSeconds: 300);
        Guid artistId = await CreateArtistAsync(client, "Candidate Artist");
        await AddMainArtistAsync(client, sourceTrackId, artistId);
        await AddMainArtistAsync(client, targetTrackId, artistId);

        using JsonDocument discovery = await DiscoverAsync(
            client,
            sourceTrackId);
        JsonElement candidate = FindCandidate(discovery, targetTrackId);

        Assert.Equal(
            targetTrackId.ToString("D").ToLowerInvariant(),
            candidate.GetProperty("candidateKey").GetString());
        Assert.Equal("medium", candidate.GetProperty("confidence").GetString());
        Assert.True(candidate.GetProperty("selectable").GetBoolean());
        Assert.False(candidate.GetProperty("isExistingRoot").GetBoolean());
        Assert.Equal(0, candidate.GetProperty("memberCount").GetInt32());
        Assert.True(
            candidate.GetProperty("requiresPromotion").GetBoolean());
        Assert.Equal(
            "remixOf",
            candidate.GetProperty("suggestedRelationTypeCode").GetString());

        using HttpResponseMessage response = await ConfirmAsync(
            client,
            sourceTrackId,
            candidate);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True(await IsOriginalAsync(client, targetTrackId));
        Assert.Equal(1, await RelationCountAsync(client));
    }

    [Fact(DisplayName = "Stale discovery confirmation revalidates without partial mutation")]
    public async Task Stale_discovery_confirmation_revalidates_without_partial_mutation()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceTrackId = await CreateTrackAsync(
            client,
            "Pulse (Remix)",
            durationSeconds: 300);
        Guid targetTrackId = await CreateTrackAsync(
            client,
            "Pulse",
            durationSeconds: 300);
        Guid artistId = await CreateArtistAsync(client, "Candidate Artist");
        await AddMainArtistAsync(client, sourceTrackId, artistId);
        await AddMainArtistAsync(client, targetTrackId, artistId);
        using JsonDocument discovery = await DiscoverAsync(
            client,
            sourceTrackId);
        JsonElement staleCandidate = FindCandidate(
            discovery,
            targetTrackId);
        Guid otherRootId = await CreateTrackAsync(client, "Other Root");
        await MarkOriginalAsync(client, otherRootId, "Other Root");
        await CreateRelationAsync(
            client,
            sourceTrackId,
            otherRootId,
            "versionOf");
        int relationCountBefore = await RelationCountAsync(client);

        using HttpResponseMessage response = await ConfirmAsync(
            client,
            sourceTrackId,
            staleCandidate);
        using JsonDocument error = await ReadJsonAsync(response);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(
            "track_relation.stack_source_not_standalone",
            error.RootElement.GetProperty("code").GetString());
        Assert.False(await IsOriginalAsync(client, targetTrackId));
        Assert.Equal(
            relationCountBefore,
            await RelationCountAsync(client));
    }
}
