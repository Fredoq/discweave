using DiscWeave.Api.Features.Discover;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed class DiscoverArtistIndexTests
{
    [Fact(DisplayName = "Discover profile artist indexes preserve truncation ordinal deduplication and encounter order")]
    public void Discover_profile_artist_indexes_preserve_truncation_ordinal_deduplication_and_encounter_order()
    {
        var collection = CollectionId.New();
        var releaseId = ReleaseId.New();
        var trackId = TrackId.New();
        string prefix = new('A', 200);
        Credit[] credits =
        [
            MakeCredit(collection, CreditTarget.ForRelease(releaseId), prefix + "first", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(releaseId), "Ignored", "remixer"),
            MakeCredit(collection, CreditTarget.ForRelease(releaseId), prefix + "second", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(releaseId), "Same", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(releaseId), "same", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(releaseId), "Last", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForTrack(trackId), "Direct remix", "remixer"),
            MakeCredit(collection, CreditTarget.ForTrack(trackId), "Ignored producer", "producer"),
            MakeCredit(collection, CreditTarget.ForTrack(trackId), "Direct main", "mainArtist", "remixer"),
            MakeCredit(collection, CreditTarget.ForTrack(trackId), "Direct remix", "mainArtist")
        ];

        Dictionary<ReleaseId, string[]> releaseArtists = DiscoverProfileService.ReleaseArtistIndex(credits);
        Dictionary<TrackId, string[]> trackArtists = DiscoverProfileService.TrackArtistIndex(credits, [], releaseArtists);

        string[] expectedRelease = [prefix, "Same", "same", "Last"];
        string[] expectedTrack = ["Direct remix", "Direct main"];
        Assert.Equal(expectedRelease, releaseArtists[releaseId]);
        Assert.Equal(expectedRelease.Take(3), releaseArtists[releaseId].Take(3));
        Assert.Equal(expectedTrack, trackArtists[trackId]);
        Assert.Equal("Direct remix", trackArtists[trackId][0]);
    }

    [Fact(DisplayName = "Discover track fallback uses release row order only when direct artist credits are absent")]
    public void Discover_track_fallback_uses_release_row_order_only_when_direct_artist_credits_are_absent()
    {
        var collection = CollectionId.New();
        var fallbackId = TrackId.New();
        var directId = TrackId.New();
        var unlinkedId = TrackId.New();
        var first = Release.Create(collection, ReleaseId.New(), "First");
        var second = Release.Create(collection, ReleaseId.New(), "Second");
        first.ReplaceTracklist([ReleaseTrack.Create(fallbackId, TrackPosition.FromNumber(1)), ReleaseTrack.Create(directId, TrackPosition.FromNumber(2))]);
        second.ReplaceTracklist([ReleaseTrack.Create(fallbackId, TrackPosition.FromNumber(1)), ReleaseTrack.Create(fallbackId, TrackPosition.FromNumber(2)),
            ReleaseTrack.CreateReleaseOnly(ReleaseTrackId.New(), TrackPosition.FromNumber(3), "Release only", TrackDetails.Empty)]);
        Credit[] credits =
        [
            MakeCredit(collection, CreditTarget.ForRelease(first.Id), "First artist", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(first.Id), "Shared", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(second.Id), "Second artist", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(second.Id), "Shared", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForTrack(fallbackId), "Ignored composer", "composer"),
            MakeCredit(collection, CreditTarget.ForTrack(directId), "Direct artist", "remixer"),
            MakeCredit(collection, CreditTarget.ForTrack(unlinkedId), "Ignored producer", "producer")
        ];
        ReleaseTrack[] rows = [.. second.Tracklist, .. first.Tracklist];
        Dictionary<ReleaseId, string[]> releaseArtists = DiscoverProfileService.ReleaseArtistIndex(credits);
        Dictionary<TrackId, string[]> trackArtists = DiscoverProfileService.TrackArtistIndex(credits, rows, releaseArtists);

        string[] expectedFallback = ["Second artist", "Shared", "First artist"];
        Assert.Equal(expectedFallback, trackArtists[fallbackId]);
        Assert.Equal("Direct artist", Assert.Single(trackArtists[directId]));
        Assert.False(trackArtists.ContainsKey(unlinkedId));
        Assert.Equal(2, trackArtists.Count);
    }

    [Fact(DisplayName = "Discover exclusion indexing preserves duplicate full artist names and title identity")]
    public void Discover_exclusion_indexing_preserves_duplicate_full_artist_names_and_title_identity()
    {
        var collection = CollectionId.New();
        var release = Release.Create(collection, ReleaseId.New(), "A title (Remix)");
        var noArtist = Release.Create(collection, ReleaseId.New(), "Other title");
        string longName = new('L', 201);
        Credit[] credits =
        [
            MakeCredit(collection, CreditTarget.ForRelease(release.Id), longName, "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(release.Id), "Artist", "mainArtist", "remixer"),
            MakeCredit(collection, CreditTarget.ForRelease(release.Id), "Artist", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(release.Id), "artist", "mainArtist"),
            MakeCredit(collection, CreditTarget.ForRelease(release.Id), "Ignored", "producer"),
            MakeCredit(collection, CreditTarget.ForTrack(TrackId.New()), "Ignored track", "mainArtist")
        ];
        HashSet<string> keys = DiscoverResolver.LocalTitles([release, noArtist], credits);

        Assert.Equal(2, keys.Count);
        Assert.Contains(DiscoverIdentity.TitleKey(release.DisplayName, [longName, "Artist", "Artist", "artist"]), keys);
        Assert.Contains(DiscoverIdentity.TitleKey(noArtist.DisplayName, []), keys);
        Assert.DoesNotContain(DiscoverIdentity.TitleKey(release.DisplayName, [longName, "Artist", "artist"]), keys);
        Assert.DoesNotContain(DiscoverIdentity.TitleKey(release.DisplayName, [longName[..200], "Artist", "Artist", "artist"]), keys);
    }

    private static Credit MakeCredit(CollectionId collection, CreditTarget target, string name, params string[] roles)
    {
        var artist = Person.Create(collection, ArtistId.New(), name);
        return Credit.Create(collection, CreditId.New(), CreditContributor.FromArtist(artist), target, roles);
    }
}
