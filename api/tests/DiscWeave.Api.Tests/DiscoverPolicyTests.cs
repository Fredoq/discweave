using DiscWeave.Api.Features.Discover;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Catalog;
using CatalogRelease = DiscWeave.Domain.Catalog.Release;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.Extensions.Configuration;

namespace DiscWeave.Api.Tests;

public sealed class DiscoverPolicyTests
{
    private static readonly int[] RatingBands = [1, 2, 3, 4, 5];
    [Fact(DisplayName = "Discover profile sampling preserves rating bands and rotates bounded examples")]
    public void Discover_profile_sampling_preserves_rating_bands_and_rotates_bounded_examples()
    {
        DiscoverExample[] examples = [.. Enumerable.Range(0, 200).Select(index =>
            new DiscoverExample("Artist " + index, "Release " + index, "release", (index % 5) + 1, index % 5 == 4))];
        DiscoverExample[] first = DiscoverProfileService.Sample(examples, "first");
        DiscoverExample[] repeated = DiscoverProfileService.Sample(examples, "first");
        DiscoverExample[] another = DiscoverProfileService.Sample(examples, "another");
        Assert.Equal(40, first.Length);
        Assert.Equal(RatingBands, first.Select(example => example.Rating).Distinct().Order());
        Assert.Equal(first, repeated);
        Assert.NotEqual(first, another);
        Assert.Contains(first, example => example.Standout);
    }

    [Fact(DisplayName = "Discover snapshots are single use collection scoped expiring and concurrency bounded")]
    public void Discover_snapshots_are_single_use_collection_scoped_expiring_and_concurrency_bounded()
    {
        var time = new MutableTimeProvider();
        var snapshots = new DiscoverSnapshots(time);
        var collection = CollectionId.New();
        string token = snapshots.Add(collection, [], "familiar");
        Assert.Null(snapshots.Take(token, CollectionId.New()));
        Assert.NotNull(snapshots.Take(token, collection));
        Assert.Null(snapshots.Take(token, collection));
        string expiring = snapshots.Add(collection, [], "familiar");
        time.Now = time.Now.AddMinutes(6);
        Assert.Null(snapshots.Take(expiring, collection));
        Assert.True(snapshots.TryBegin(collection));
        Assert.False(snapshots.TryBegin(collection));
        snapshots.End(collection);
        Assert.True(snapshots.TryBegin(collection));
    }

    [Theory(DisplayName = "Discover rejects untrusted release URLs")]
    [InlineData("http://www.discogs.com/release/123")]
    [InlineData("https://user@www.discogs.com/release/123")]
    [InlineData("https://www.discogs.com:444/release/123")]
    [InlineData("https://discogs.com.attacker.test/release/123")]
    [InlineData("https://www.discogs.com/release/1234")]
    [InlineData("https://www.discogs.com/artist/123")]
    public void Discover_rejects_untrusted_release_urls(string url)
    {
        Assert.False(DiscoverIdentity.IsDiscogsRelease(new ExternalMetadataSource("discogs", "release", "123", url, "Discogs")));
    }

    [Fact(DisplayName = "Discover preserves remix identity and excludes known masters")]
    public void Discover_preserves_remix_identity_and_excludes_known_masters()
    {
        ExternalMetadataReleaseDetail remix = Release("123", "Artist", "Song (Club Mix)", "9");
        Assert.False(DiscoverIdentity.Matches(new DiscoverLead("Artist", "Song"), remix));
        Assert.True(DiscoverIdentity.Matches(new DiscoverLead("Artist", "Song (Club Mix)"), remix));
        Assert.False(DiscoverResolver.Eligible(new DiscoverLead("Artist", "Song (Club Mix)"), remix,
            new HashSet<string> { DiscoverIdentity.MasterKey("9", "Song (Club Mix)", []) }, new HashSet<string>()));
        Assert.True(DiscoverResolver.Eligible(new DiscoverLead("Artist", "Song (Club Mix)"), remix,
            new HashSet<string> { DiscoverIdentity.MasterKey("9", "Song", []) }, new HashSet<string>()));
    }

    [Fact(DisplayName = "Discover master exclusion distinguishes the same remix edition from a different recording")]
    public void Discover_master_exclusion_distinguishes_the_same_remix_edition_from_a_different_recording()
    {
        var trackId = TrackId.New();
        var local = CatalogRelease.Create(CollectionId.New(), ReleaseId.New(), "Song");
        local.ReplaceTracklist([ReleaseTrack.Create(trackId, TrackPosition.FromNumber(1))]);
        local.ReplaceExternalSources([ExternalSourceReference.Create("discogs", "master", "9", "https://www.discogs.com/master/9", DateTimeOffset.UtcNow)]);
        HashSet<string> keys = DiscoverResolver.LocalKeys([local], new Dictionary<TrackId, string> { [trackId] = "Song (Club Mix)" });
        Assert.Contains(DiscoverIdentity.MasterKey("9", "Song", ["Song (Club Mix)"]), keys);
        Assert.DoesNotContain(DiscoverIdentity.MasterKey("9", "Song", ["Song (Acoustic Version)"]), keys);
        Assert.Empty(DiscoverResolver.LocalKeys([local], new Dictionary<TrackId, string>()));
    }

    [Fact(DisplayName = "Discover ranking excludes negative artists and limits repeated artists without filling")]
    public void Discover_ranking_excludes_negative_artists_and_limits_repeated_artists_without_filling()
    {
        var snapshot = new DiscoverSnapshot(CollectionId.New(),
            [new DiscoverExample("Liked", "Known", "release", 5, true), new DiscoverExample("Disliked", "Known", "track", 1, false)],
            "familiar", DateTimeOffset.UtcNow.AddMinutes(5));
        ExternalMetadataReleaseDetail[] candidates = [Release("1", "Liked"), Release("2", "Liked"), Release("3", "Liked"),
            Release("4", "Disliked"), Release("5", "New artist")];
        ExternalMetadataReleaseDetail[] result = DiscoverResolver.Choose(candidates, snapshot);
        Assert.Equal(3, result.Length);
        Assert.Equal("Liked", result[0].Artists[0]);
        Assert.DoesNotContain(result, release => release.Artists.Contains("Disliked"));
    }

    [Fact(DisplayName = "Discover history persists feedback separately and does not cross collections")]
    public async Task Discover_history_persists_feedback_separately_and_does_not_cross_collections()
    {
        string directory = Path.Combine(Path.GetTempPath(), "discweave-discover-tests-" + Guid.CreateVersion7());
        IConfigurationRoot config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DiscWeave:DiscoverHistoryDirectory"] = directory
        }).Build();
        var time = new MutableTimeProvider();
        var collection = CollectionId.New();
        try
        {
            using (var store = new DiscoverHistoryStore(config, time))
            {
                Assert.False(await store.RecordAsync(collection, [new DiscoverHistoryEntry("1", ["release:1"], "alreadyKnow", time.Now)], true, CancellationToken.None));
                Assert.True(await store.RecordAsync(collection, [store.Shown("1", ["release:1", "master:8"])], false, CancellationToken.None));
                Assert.Empty(await store.ReadAsync(CollectionId.New(), CancellationToken.None));
                Assert.True(await store.RecordAsync(collection, [new DiscoverHistoryEntry("1", ["release:1", "master:8"], "alreadyKnow", time.Now)], true, CancellationToken.None));
            }

            time.Now = time.Now.AddDays(31);
            using var reloaded = new DiscoverHistoryStore(config, time);
            DiscoverHistoryEntry entry = Assert.Single(await reloaded.ReadAsync(collection, CancellationToken.None));
            Assert.Equal("alreadyKnow", entry.Kind);
            Assert.Contains("master:8", entry.Keys);
        }
        finally
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, true);
            }
        }
    }

    internal static ExternalMetadataReleaseDetail Release(string id, string artist, string title = "New release", string? master = null)
    {
        return new ExternalMetadataReleaseDetail(new ExternalMetadataSource("discogs", "release", id,
            "https://www.discogs.com/release/" + id, "Data provided by Discogs."), title, [artist], 2000, null,
            ["Label"], ["Vinyl"], "album", ["Electronic"], [], [], null, [], [],
            relatedSources: master is null ? [] : [new ExternalMetadataSource("discogs", "master", master,
                "https://www.discogs.com/master/" + master, "Data provided by Discogs.")]);
    }

    private sealed class MutableTimeProvider : TimeProvider
    {
        public DateTimeOffset Now { get; set; } = new(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        public override DateTimeOffset GetUtcNow()
        {
            return Now;
        }
    }
}
