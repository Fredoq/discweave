using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackStackTargetEndpointTests
{
    [Fact(DisplayName = "Stack target search orders and pages results deterministically")]
    public async Task Stack_target_search_orders_and_pages_results_deterministically()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming");
        (Guid firstRootId, _) = await CreateStackAsync(
            client,
            "Bass Alpha",
            "Alpha Member");
        (Guid secondRootId, _) = await CreateStackAsync(
            client,
            "Bass Beta",
            "Beta Member");
        (Guid artistRootId, _) = await CreateStackAsync(
            client,
            "Gamma Root",
            "Gamma Member",
            rootArtist: "Bass Artist");
        (Guid memberRootId, _) = await CreateStackAsync(
            client,
            "Delta Root",
            "Bass Member");
        Guid[] expected = [firstRootId, secondRootId, artistRootId, memberRootId];

        using JsonDocument all = await GetTargetsAsync(client, sourceId, "Bass", 0, 50);
        using JsonDocument firstPage = await GetTargetsAsync(client, sourceId, "Bass", 0, 2);
        using JsonDocument secondPage = await GetTargetsAsync(client, sourceId, "Bass", 2, 2);
        Guid[] combined = [.. RootIds(firstPage), .. RootIds(secondPage)];

        Assert.Equal(expected, RootIds(all));
        Assert.Equal(expected, combined);
        Assert.Equal(combined.Length, combined.Distinct().Count());
        Assert.Equal(4, all.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Stack target search is isolated to the active collection")]
    public async Task Stack_target_search_is_isolated_to_the_active_collection()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient owner, HttpClient other) = await CreateAuthenticatedClientsAsync(host);
        Guid ownerSource = await CreateTrackAsync(owner, "Owner Source");
        _ = await CreateTrackAsync(other, "Foreign Source");
        (Guid ownerRoot, Guid ownerMember) = await CreateStackAsync(
            owner,
            "Owner Root",
            "Shared Member");
        (Guid foreignRoot, Guid foreignMember) = await CreateStackAsync(
            other,
            "Foreign Root",
            "Shared Member");

        using JsonDocument response = await GetTargetsAsync(
            owner,
            ownerSource,
            "Shared Member");
        JsonElement item = Assert.Single(Items(response));
        Assert.Equal(ownerRoot, item.GetProperty("rootTrackId").GetGuid());
        Assert.Equal(
            ownerMember,
            item.GetProperty("matchedMember").GetProperty("trackId").GetGuid());
        Assert.NotEqual(foreignRoot, item.GetProperty("rootTrackId").GetGuid());
        Assert.NotEqual(
            foreignMember,
            item.GetProperty("matchedMember").GetProperty("trackId").GetGuid());
        Assert.Equal(1, response.RootElement.GetProperty("total").GetInt32());
    }
}
