using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackStackTargetEndpointTests
{
    [Fact(DisplayName = "Stack target search matches root and member titles and artists")]
    public async Task Stack_target_search_matches_root_and_member_titles_and_artists()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming Dub");
        Guid rootId = await CreateTrackAsync(client, "Phat Bass");
        Guid memberId = await CreateTrackAsync(client, "Aquagen More Bass Mix");
        Guid otherRootId = await CreateTrackAsync(client, "Energy Flash");
        Guid otherMemberId = await CreateTrackAsync(client, "Energy Flash Edit");
        await MarkOriginalAsync(client, rootId, "Phat Bass", 2000);
        await MarkOriginalAsync(client, otherRootId, "Energy Flash", null);
        await AddMainArtistAsync(client, rootId, "Warp Brothers");
        await AddMainArtistAsync(client, memberId, "Aquagen");
        await AddMainArtistAsync(client, otherRootId, "Joey Beltram");
        await AddMainArtistAsync(client, otherMemberId, "Joey Beltram");
        await CreateRelationAsync(client, memberId, rootId, "remixOf");
        await CreateRelationAsync(client, otherMemberId, otherRootId, "versionOf");

        using JsonDocument rootTitle = await GetTargetsAsync(client, sourceId, "Phat");
        using JsonDocument rootArtist = await GetTargetsAsync(client, sourceId, "Warp");
        using JsonDocument memberTitle = await GetTargetsAsync(client, sourceId, "More Bass");
        using JsonDocument memberArtist = await GetTargetsAsync(client, sourceId, "Aquagen");

        foreach (JsonDocument rootMatch in new[] { rootTitle, rootArtist })
        {
            JsonElement item = Assert.Single(Items(rootMatch));
            Assert.Equal(rootId, item.GetProperty("rootTrackId").GetGuid());
            Assert.Equal("Phat Bass", item.GetProperty("title").GetString());
            Assert.Equal("Warp Brothers", item.GetProperty("artistDisplay").GetString());
            Assert.Equal(2000, item.GetProperty("versionYear").GetInt32());
            Assert.Equal(1, item.GetProperty("memberCount").GetInt32());
            Assert.Equal(JsonValueKind.Null, item.GetProperty("matchedMember").ValueKind);
        }

        foreach (JsonDocument memberMatch in new[] { memberTitle, memberArtist })
        {
            JsonElement item = Assert.Single(Items(memberMatch));
            JsonElement matchedMember = item.GetProperty("matchedMember");
            Assert.Equal(rootId, item.GetProperty("rootTrackId").GetGuid());
            Assert.Equal(memberId, matchedMember.GetProperty("trackId").GetGuid());
            Assert.Equal("Aquagen More Bass Mix", matchedMember.GetProperty("title").GetString());
            Assert.Equal("Aquagen", matchedMember.GetProperty("artistDisplay").GetString());
        }
    }

    [Fact(DisplayName = "Stack target search returns one root and a deterministic matching member")]
    public async Task Stack_target_search_returns_one_root_and_a_deterministic_matching_member()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming Version");
        Guid rootId = await CreateTrackAsync(client, "Destination Root");
        Guid firstMemberId = await CreateTrackAsync(client, "Matched Dub");
        Guid secondMemberId = await CreateTrackAsync(client, "Matched Dub");
        await MarkOriginalAsync(client, rootId, "Destination Root", null);
        await CreateRelationAsync(client, secondMemberId, rootId, "versionOf");
        await CreateRelationAsync(client, firstMemberId, rootId, "remixOf");

        using JsonDocument document = await GetTargetsAsync(client, sourceId, "matched");

        JsonElement item = Assert.Single(Items(document));
        Guid expectedMemberId = firstMemberId.CompareTo(secondMemberId) <= 0
            ? firstMemberId
            : secondMemberId;
        Assert.Equal(rootId, item.GetProperty("rootTrackId").GetGuid());
        Assert.Equal(2, item.GetProperty("memberCount").GetInt32());
        Assert.Equal(
            expectedMemberId,
            item.GetProperty("matchedMember").GetProperty("trackId").GetGuid());
    }

    [Fact(DisplayName = "Stack target search excludes standalone tracks and empty original roots")]
    public async Task Stack_target_search_excludes_standalone_tracks_and_empty_original_roots()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Incoming Track");
        _ = await CreateTrackAsync(client, "Bass Standalone");
        Guid emptyRootId = await CreateTrackAsync(client, "Bass Empty Root");
        Guid realRootId = await CreateTrackAsync(client, "Bass Real Root");
        Guid memberId = await CreateTrackAsync(client, "Member");
        await MarkOriginalAsync(client, emptyRootId, "Bass Empty Root", null);
        await MarkOriginalAsync(client, realRootId, "Bass Real Root", null);
        await CreateRelationAsync(client, memberId, realRootId, "versionOf");

        using JsonDocument document = await GetTargetsAsync(client, sourceId, "Bass");

        JsonElement item = Assert.Single(Items(document));
        Assert.Equal(realRootId, item.GetProperty("rootTrackId").GetGuid());
    }
}
