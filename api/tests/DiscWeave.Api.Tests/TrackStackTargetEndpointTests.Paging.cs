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

    [Fact(DisplayName = "Stack target paging uses root ID when normalized titles are equal")]
    public async Task Stack_target_paging_uses_root_id_when_normalized_titles_are_equal()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming");
        (Guid firstRootId, _) = await CreateStackAsync(
            client,
            "Bass Equal",
            "First Member");
        (Guid secondRootId, _) = await CreateStackAsync(
            client,
            "bass equal",
            "Second Member");
        Guid[] expected = [firstRootId, secondRootId];
        Array.Sort(expected);

        using JsonDocument all = await GetTargetsAsync(client, sourceId, "Bass", 0, 50);
        using JsonDocument firstPage = await GetTargetsAsync(client, sourceId, "Bass", 0, 1);
        using JsonDocument secondPage = await GetTargetsAsync(client, sourceId, "Bass", 1, 1);
        Guid[] paged = [.. RootIds(firstPage), .. RootIds(secondPage)];

        Assert.Equal(expected, RootIds(all));
        Assert.Equal(expected, paged);
    }

    [Fact(DisplayName = "Stack target paging preserves deterministic member representatives")]
    public async Task Stack_target_paging_preserves_deterministic_member_representatives()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming");
        (Guid firstRootId, Guid zebraMemberId) = await CreateStackAsync(
            client,
            "Alpha Root",
            "Bass Zebra");
        Guid alphaMemberId = await CreateTrackAsync(client, "bass alpha");
        await CreateRelationAsync(client, alphaMemberId, firstRootId, "versionOf");
        (Guid secondRootId, Guid firstSameMemberId) = await CreateStackAsync(
            client,
            "Beta Root",
            "Bass Same");
        Guid secondSameMemberId = await CreateTrackAsync(client, "bass same");
        await CreateRelationAsync(client, secondSameMemberId, secondRootId, "versionOf");
        Guid expectedSameMemberId = firstSameMemberId.CompareTo(secondSameMemberId) <= 0
            ? firstSameMemberId
            : secondSameMemberId;

        using JsonDocument all = await GetTargetsAsync(client, sourceId, "Bass", 0, 50);
        using JsonDocument firstPage = await GetTargetsAsync(client, sourceId, "Bass", 0, 1);
        using JsonDocument secondPage = await GetTargetsAsync(client, sourceId, "Bass", 1, 1);
        JsonElement[] allItems = [.. Items(all)];
        JsonElement firstPageItem = Assert.Single(Items(firstPage));
        JsonElement secondPageItem = Assert.Single(Items(secondPage));
        Guid allFirstMemberId = allItems[0]
            .GetProperty("matchedMember")
            .GetProperty("trackId")
            .GetGuid();
        Guid allSecondMemberId = allItems[1]
            .GetProperty("matchedMember")
            .GetProperty("trackId")
            .GetGuid();

        Assert.Equal([firstRootId, secondRootId], RootIds(all));
        Assert.Equal(2, allItems.Length);
        Assert.NotEqual(zebraMemberId, allFirstMemberId);
        Assert.Equal(alphaMemberId, allFirstMemberId);
        Assert.Equal(expectedSameMemberId, allSecondMemberId);
        Assert.Equal(
            allFirstMemberId,
            firstPageItem.GetProperty("matchedMember").GetProperty("trackId").GetGuid());
        Assert.Equal(
            allSecondMemberId,
            secondPageItem.GetProperty("matchedMember").GetProperty("trackId").GetGuid());
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
