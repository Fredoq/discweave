using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Playlists;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackMergeEndpointTests
{
    private static Task<Seed> SeedAsync(ApiTestHost host) => host.WithTrackMergeContextAsync(async context =>
    {
        CollectionId collection = host.DefaultCollectionId;
        Track keeper = Track.Create(collection, TrackId.New(), "Fire").WithDuration(TimeSpan.FromSeconds(240));
        Track duplicate = Track.Create(collection, TrackId.New(), "Fire").WithDuration(TimeSpan.FromSeconds(241));
        var other = Track.Create(collection, TrackId.New(), "Other");
        keeper.UpdateMetadata(TrackMetadata.Empty.WithVersionYear(2004));
        duplicate.UpdateMetadata(TrackMetadata.Empty.WithVersionYear(2005));
        keeper.UpdateCataloging(Cataloging.Empty.WithGenre(Genre.FromName("Electronic")));
        duplicate.UpdateCataloging(Cataloging.Empty.WithTag(Tag.FromName("Favorite")));
        keeper.ReplaceExternalSources([ExternalSourceReference.Create("musicbrainz", "recording", "recording-one", "https://musicbrainz.org/recording/recording-one", DateTimeOffset.UnixEpoch)]);
        duplicate.ReplaceExternalSources([ExternalSourceReference.Create("discogs", "release-track", "release-two:1", "https://www.discogs.com/release/2", DateTimeOffset.UnixEpoch)]);
        context.Tracks.AddRange(keeper, duplicate, other);
        var artist = Person.Create(collection, ArtistId.New(), "Example Artist");
        _ = context.Artists.Add(artist);
        var keeperCredit = Credit.Create(collection, CreditId.New(), CreditContributor.FromArtist(artist), CreditTarget.ForTrack(keeper.Id), "mainArtist");
        context.Credits.AddRange(keeperCredit, Credit.Create(collection, CreditId.New(), CreditContributor.FromArtist(artist), CreditTarget.ForTrack(duplicate.Id), ["mainArtist", "producer"]));
        var first = Release.Create(collection, ReleaseId.New(), "Fire EP");
        var second = Release.Create(collection, ReleaseId.New(), "Annual Compilation");
        var keeperRow = ReleaseTrack.Create(keeper.Id, TrackPosition.FromNumber(1));
        ReleaseTrack duplicateRow = ReleaseTrack.Create(duplicate.Id, TrackPosition.FromNumber(2, "CD 2", "A"), "Fire on this edition")
            .WithArtistCredits([ReleaseTrackArtistCredit.Create(artist.Id, ["mainArtist"])]);
        var secondDuplicateRow = ReleaseTrack.Create(duplicate.Id, TrackPosition.FromNumber(3));
        first.ReplaceTracklist([keeperRow, duplicateRow]);
        second.ReplaceTracklist([secondDuplicateRow]);
        context.Releases.AddRange(first, second);
        var owned = OwnedItem.Create(collection, OwnedItemId.New(), first.Id, OwnershipStatus.Owned, DigitalFile.Create());
        _ = context.OwnedItems.Add(owned);
        LocalAudioFile file = LocalAudioFile.Create(collection, LocalAudioFileId.New(), FilePath.FromAbsolutePath("/synthetic/never-read/fire.flac")).WithContentHash("original-hash").WithDuration(TimeSpan.FromSeconds(241));
        _ = context.LocalAudioFiles.Add(file);
        var link = DigitalTrackFileLink.Create(collection, DigitalTrackFileLinkId.New(), owned.Id, duplicateRow.Id, file.Id);
        _ = context.DigitalTrackFileLinks.Add(link);
        var playlist = Playlist.Create(collection, PlaylistId.New(), "Preserve repeat plays", PlaylistType.Manual);
        playlist.ReplaceManualEntries([PlaylistEntry.ForTrack(0, duplicate.Id), PlaylistEntry.ForTrack(1, other.Id), PlaylistEntry.ForTrack(2, keeper.Id), PlaylistEntry.ForTrack(3, duplicate.Id)]);
        _ = context.Playlists.Add(playlist);
        var criterion = RatingCriterion.Create(RatingCriterionId.New(), collection, "merge-test", "Merge Test", [RatingTargetType.Track], 999);
        _ = context.RatingCriteria.Add(criterion);
        var keeperRating = RatingValue.Create(collection, RatingValueId.New(), criterion.Id, RatingTarget.ForTrack(keeper.Id), Rating.FromValue(4));
        context.RatingValues.AddRange(keeperRating, RatingValue.Create(collection, RatingValueId.New(), criterion.Id, RatingTarget.ForTrack(duplicate.Id), Rating.FromValue(4)));
        var keeperRelation = TrackRelation.Create(TrackRelationId.New(), collection, keeper.Id, other.Id, "versionOf");
        context.TrackRelations.AddRange(keeperRelation,
            TrackRelation.Create(TrackRelationId.New(), collection, duplicate.Id, other.Id, "versionOf"),
            TrackRelation.Create(TrackRelationId.New(), collection, duplicate.Id, other.Id, "remixOf"));
        _ = await context.SaveChangesAsync();
        return new Seed(keeper.Id, duplicate.Id, other.Id, keeperRow.Id, duplicateRow.Id, secondDuplicateRow.Id, link.Id, file.Id, keeperCredit.Id, keeperRating.Id, keeperRelation.Id);
    });

    private static async Task AssertMergedAsync(ApiTestHost host, Seed seed)
    {
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            Assert.False(await context.Tracks.AnyAsync(track => track.Id == seed.Duplicate));
            Track keeper = await context.Tracks.SingleAsync(track => track.Id == seed.Keeper);
            Assert.Equal(240, keeper.Details.Duration.Match(value => value.TotalSeconds, () => 0));
            Assert.Equal(2004, keeper.Metadata.VersionYear.Match(value => value, () => 0));
            Assert.Contains(keeper.Cataloging.Genres, genre => genre.Name == "Electronic");
            Assert.Contains(keeper.Cataloging.Tags, tag => tag.Name == "Favorite");
            Assert.Equal(2, keeper.ExternalSources.Count);
            ReleaseTrack[] rows = await context.ReleaseTracks.ToArrayAsync();
            Assert.Equal(3, rows.Length);
            Assert.All(rows, row => Assert.Equal(seed.Keeper, row.TrackId));
            Assert.Contains(rows, row => row.Id == seed.KeeperRow);
            Assert.Contains(rows, row => row.Id == seed.SecondDuplicateRow);
            ReleaseTrack duplicateRow = Assert.Single(rows, row => row.Id == seed.DuplicateRow);
            Assert.Equal(2, duplicateRow.Position.Number);
            Assert.Equal("CD 2", duplicateRow.Position.Disc.Match(value => value, () => ""));
            Assert.Equal("A", duplicateRow.Position.Side.Match(value => value, () => ""));
            Assert.Equal("Fire on this edition", duplicateRow.TitleOverride.Match(value => value, () => ""));
            _ = Assert.Single(duplicateRow.ArtistCredits);
            LocalAudioFile file = await context.LocalAudioFiles.SingleAsync();
            Assert.Equal(seed.File, file.Id);
            Assert.Equal("/synthetic/never-read/fire.flac", file.Path.Value);
            Assert.Equal("original-hash", file.ContentHash.Match(value => value, () => ""));
            DigitalTrackFileLink link = await context.DigitalTrackFileLinks.SingleAsync();
            Assert.Equal(seed.Link, link.Id);
            Assert.Equal(seed.DuplicateRow, link.ReleaseTrackId);
            Assert.Equal(seed.File, link.LocalAudioFileId);
            Playlist playlist = await context.Playlists.SingleAsync();
            Assert.Equal([0, 1, 2, 3], playlist.Entries.Select(entry => entry.Position));
            Assert.Equal([seed.Keeper, seed.Other, seed.Keeper, seed.Keeper], playlist.Entries.Select(entry => entry.TrackId.Match(value => value, () => default)));
            Credit credit = await context.Credits.SingleAsync();
            Assert.Equal(seed.Credit, credit.Id);
            Assert.Equal(seed.Keeper, Assert.IsType<TrackCreditTarget>(credit.Target).TrackId);
            Assert.Equal(["mainArtist", "producer"], credit.Roles);
            RatingValue rating = await context.RatingValues.SingleAsync();
            Assert.Equal(seed.Rating, rating.Id);
            Assert.Equal(seed.Keeper, Assert.IsType<TrackRatingTarget>(rating.Target).TrackId);
            Assert.Equal(4, rating.Rating.Value);
            TrackRelation[] relations = await context.TrackRelations.ToArrayAsync();
            Assert.Equal(2, relations.Length);
            Assert.All(relations, relation => { Assert.Equal(seed.Keeper, relation.SourceTrackId); Assert.Equal(seed.Other, relation.TargetTrackId); });
            Assert.Contains(relations, relation => relation.Id == seed.Relation);
            return true;
        });
    }

    private static async Task AssertUnchangedAsync(ApiTestHost host, Seed seed)
    {
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            Assert.Equal(3, await context.Tracks.CountAsync());
            ReleaseTrack row = await context.ReleaseTracks.SingleAsync(row => row.Id == seed.DuplicateRow);
            Assert.Equal(seed.Duplicate, row.TrackId);
            Assert.Equal(2, await context.Credits.CountAsync());
            Assert.Equal(2, await context.RatingValues.CountAsync());
            Assert.Equal(3, await context.TrackRelations.CountAsync());
            Track keeper = await context.Tracks.SingleAsync(track => track.Id == seed.Keeper);
            Assert.Empty(keeper.Cataloging.Tags);
            _ = Assert.Single(keeper.ExternalSources);
            Playlist playlist = await context.Playlists.SingleAsync();
            Assert.Equal(seed.Duplicate, playlist.Entries[0].TrackId.Match(value => value, () => default));
            Assert.Equal(seed.Duplicate, playlist.Entries[3].TrackId.Match(value => value, () => default));
            Assert.Equal(seed.Link, (await context.DigitalTrackFileLinks.SingleAsync()).Id);
            return true;
        });
    }

    private sealed record Seed(TrackId Keeper, TrackId Duplicate, TrackId Other, ReleaseTrackId KeeperRow,
        ReleaseTrackId DuplicateRow, ReleaseTrackId SecondDuplicateRow, DigitalTrackFileLinkId Link,
        LocalAudioFileId File, CreditId Credit, RatingValueId Rating, TrackRelationId Relation);
}
