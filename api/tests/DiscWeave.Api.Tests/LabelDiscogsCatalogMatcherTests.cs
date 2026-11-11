using DiscWeave.Api.Features.Labels;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Tests;

public sealed class LabelDiscogsCatalogMatcherTests
{
    [Fact(DisplayName = "Only a matching Discogs release identity confirms an edition")]
    public void Only_a_matching_Discogs_release_identity_confirms_an_edition()
    {
        var collection = CollectionId.New();
        var release = Release.Create(collection, ReleaseId.New(), "Album");
        release.ReplaceExternalSources([ExternalSourceReference.Create("discogs", "release", "123", "https://www.discogs.com/release/123", DateTimeOffset.UtcNow)]);
        LabelDiscogsCatalogItemResponse[] result = LabelDiscogsCatalogMatcher.Match(LabelId.New(),
            [new("123", "ABC01", "Artist", "Album", 2000, "LP"), new("124", "ABC01", "Artist", "Album", 2000, "CD")], [release], [], [OwnedItem.Create(collection, OwnedItemId.New(), release.Id, OwnershipStatus.Wanted, DigitalFile.Create())]);
        Assert.True(result[0].Matches[0].Wanted);
        Assert.Equal("exact", result[0].MatchKind);
        Assert.Equal(release.Id.Value, Assert.Single(result[0].Matches).ReleaseId);
        Assert.False(result[0].Matches[0].InCollection);
        Assert.Equal("unmatched", result[1].MatchKind);
    }

    [Fact(DisplayName = "Catalog number normalization proposes matches without merging or crossing label boundaries")]
    public void Catalog_number_normalization_proposes_matches_without_merging_or_crossing_label_boundaries()
    {
        var collection = CollectionId.New();
        var label = LabelId.New();
        var release = Release.Create(collection, ReleaseId.New(), "Album");
        release.UpdateLabels(false, [ReleaseLabel.Create(label, Optional.From("abc 001"), false)]);
        var credit = Credit.Create(collection, CreditId.New(), CreditContributor.FromArtist(Person.Create(collection, ArtistId.New(), "Artist")), CreditTarget.ForRelease(release.Id), CreditRole.MainArtist);
        DiscogsLabelCatalogItem[] items = [new("123", "ABC001", "Artist", "Album", 2000, "LP"), new("124", "ABC002", "Artist", "Album", 2000, "LP")];
        LabelDiscogsCatalogItemResponse[] result = LabelDiscogsCatalogMatcher.Match(label, items, [release], [credit], []);
        Assert.Equal("possible", result[0].MatchKind);
        Assert.Equal("unmatched", result[1].MatchKind);
        Assert.Equal("unmatched", LabelDiscogsCatalogMatcher.Match(LabelId.New(), items, [release], [credit], [])[0].MatchKind);
        Assert.Equal("unmatched", LabelDiscogsCatalogMatcher.Match(label, items, [release], [], [])[0].MatchKind);
        Assert.Equal("abc 001", release.Labels[0].CatalogNumber.Match(value => value, () => ""));
    }

    [Fact(DisplayName = "Artist suffixes and explicitly various artist releases remain only possible matches")]
    public void Artist_suffixes_and_explicitly_various_artist_releases_remain_only_possible_matches()
    {
        var collection = CollectionId.New();
        var label = LabelId.New();
        var release = Release.Create(collection, ReleaseId.New(), "Album");
        release.UpdateLabels(false, [ReleaseLabel.Create(label, Optional.From("ABC001"), false)]);
        var artist = Person.Create(collection, ArtistId.New(), "Artist");
        var credit = Credit.Create(collection, CreditId.New(), CreditContributor.FromArtist(artist), CreditTarget.ForRelease(release.Id), CreditRole.MainArtist);
        DiscogsLabelCatalogItem[] items = [new("123", "ABC001", "Artist (2)", "Album", 2000, "LP")];
        Assert.Equal("possible", LabelDiscogsCatalogMatcher.Match(label, items, [release], [credit], [])[0].MatchKind);
        release.UpdateArtistDisplay(true);
        DiscogsLabelCatalogItem[] various = [new("124", "ABC001", "Various", "Album", 2000, "LP")];
        Assert.Equal("possible", LabelDiscogsCatalogMatcher.Match(label, various, [release], [], [])[0].MatchKind);
        release.UpdateArtistDisplay(false);
        Assert.Equal("unmatched", LabelDiscogsCatalogMatcher.Match(label, various, [release], [], [])[0].MatchKind);
    }

    [Theory(DisplayName = "Unknown catalog numbers do not become identifiers")]
    [InlineData("")]
    [InlineData("none")]
    [InlineData(" NONE ")]
    [InlineData("---")]
    public void Unknown_catalog_numbers_do_not_become_identifiers(string value)
    {
        Assert.Empty(LabelDiscogsCatalogMatcher.CatalogKey(value));
    }
}
