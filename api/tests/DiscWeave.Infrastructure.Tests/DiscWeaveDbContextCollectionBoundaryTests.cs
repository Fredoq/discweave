using DiscWeave.Application.Errors;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class DiscWeaveDbContextCollectionBoundaryTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public DiscWeaveDbContextCollectionBoundaryTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Cross-collection release track references fail")]
    public async Task Cross_collection_release_track_references_fail()
    {
        await AssertForeignKeyViolationAsync(async context =>
        {
            var releaseCollectionId = CollectionId.New();
            var trackCollectionId = CollectionId.New();
            await TestCollectionFactory.AddCollectionAsync(context, releaseCollectionId);
            await TestCollectionFactory.AddCollectionAsync(context, trackCollectionId);
            var track = Track.Create(trackCollectionId, TrackId.New(), "Confusion");
            Release release = Release.Create(releaseCollectionId, ReleaseId.New(), "Confusion")
                .WithTrack(ReleaseTrack.Create(track.Id, TrackPosition.FromNumber(1)));

            _ = context.Tracks.Add(track);
            _ = context.Releases.Add(release);
            await Task.CompletedTask;
        });
    }

    [Fact(DisplayName = "Cross-collection credit references fail")]
    public async Task Cross_collection_credit_references_fail()
    {
        await AssertForeignKeyViolationAsync(async context =>
        {
            var targetCollectionId = CollectionId.New();
            var artistCollectionId = CollectionId.New();
            await TestCollectionFactory.AddCollectionAsync(context, targetCollectionId);
            await TestCollectionFactory.AddCollectionAsync(context, artistCollectionId);
            Artist artist = Person.Create(artistCollectionId, ArtistId.New(), "Arthur Baker");
            var release = Release.Create(targetCollectionId, ReleaseId.New(), "Confusion");

            _ = context.Artists.Add(artist);
            _ = context.Releases.Add(release);
            _ = await context.SaveChangesAsync();
            _ = context.Credits.Add(Credit.Create(targetCollectionId, CreditId.New(), CreditContributor.FromArtist(artist), CreditTarget.ForRelease(release.Id), CreditRole.Producer));
        });
    }

    [Fact(DisplayName = "Cross-collection relation references fail")]
    public async Task Cross_collection_relation_references_fail()
    {
        await AssertForeignKeyViolationAsync(async context =>
        {
            var relationCollectionId = CollectionId.New();
            var targetCollectionId = CollectionId.New();
            await TestCollectionFactory.AddCollectionAsync(context, relationCollectionId);
            await TestCollectionFactory.AddCollectionAsync(context, targetCollectionId);
            Artist source = Person.Create(relationCollectionId, ArtistId.New(), "Arthur Baker");
            Artist target = Person.Create(targetCollectionId, ArtistId.New(), "Arthur Baker Alias");

            _ = context.Artists.Add(source);
            _ = context.Artists.Add(target);
            _ = await context.SaveChangesAsync();
            _ = context.ArtistRelations.Add(ArtistRelation.Create(ArtistRelationId.New(), relationCollectionId, source.Id, target.Id, ArtistRelationType.Alias));
        });
    }

    [Fact(DisplayName = "Cross-collection owned item references fail")]
    public async Task Cross_collection_owned_item_references_fail()
    {
        await AssertForeignKeyViolationAsync(async context =>
        {
            var itemCollectionId = CollectionId.New();
            var releaseCollectionId = CollectionId.New();
            await TestCollectionFactory.AddCollectionAsync(context, itemCollectionId);
            await TestCollectionFactory.AddCollectionAsync(context, releaseCollectionId);
            var release = Release.Create(releaseCollectionId, ReleaseId.New(), "Confusion");

            _ = context.Releases.Add(release);
            _ = await context.SaveChangesAsync();
            _ = context.OwnedItems.Add(OwnedItem.Create(itemCollectionId, OwnedItemId.New(), release.Id, OwnershipStatus.Owned, VinylRecord.Create("12-inch")));
        });
    }

    [Fact(DisplayName = "Cross-collection digital track file link references fail")]
    public async Task Cross_collection_digital_track_file_link_references_fail()
    {
        await AssertForeignKeyViolationAsync(async context =>
        {
            var linkCollectionId = CollectionId.New();
            var fileCollectionId = CollectionId.New();
            await TestCollectionFactory.AddCollectionAsync(context, linkCollectionId);
            await TestCollectionFactory.AddCollectionAsync(context, fileCollectionId);
            var track = Track.Create(linkCollectionId, TrackId.New(), "Confusion");
            var releaseTrackId = ReleaseTrackId.New();
            Release release = Release.Create(linkCollectionId, ReleaseId.New(), "Confusion")
                .WithTrack(ReleaseTrack.Create(releaseTrackId, track.Id, TrackPosition.FromNumber(1)));
            var copy = OwnedItem.Create(linkCollectionId, OwnedItemId.New(), release.Id, OwnershipStatus.Owned, DigitalFile.Create());
            var file = LocalAudioFile.Create(
                fileCollectionId,
                LocalAudioFileId.New(),
                FilePath.FromAbsolutePath("/music/other/Confusion.flac"));

            _ = context.Tracks.Add(track);
            _ = context.Releases.Add(release);
            _ = context.OwnedItems.Add(copy);
            _ = context.LocalAudioFiles.Add(file);
            _ = await context.SaveChangesAsync();
            _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
                linkCollectionId,
                DigitalTrackFileLinkId.New(),
                copy.Id,
                releaseTrackId,
                file.Id));
        });
    }

    [Fact(DisplayName = "Duplicate local audio file paths are unique per collection")]
    public async Task Duplicate_local_audio_file_paths_are_unique_per_collection()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync();
        var firstCollectionId = CollectionId.New();
        var secondCollectionId = CollectionId.New();
        await TestCollectionFactory.AddCollectionAsync(context, firstCollectionId);
        await TestCollectionFactory.AddCollectionAsync(context, secondCollectionId);

        _ = context.LocalAudioFiles.Add(CreateLocalAudioFile(firstCollectionId));
        _ = context.LocalAudioFiles.Add(CreateLocalAudioFile(secondCollectionId));
        _ = await context.SaveChangesAsync();

        _ = context.LocalAudioFiles.Add(CreateLocalAudioFile(firstCollectionId));
        ResourceConflictException exception = await Assert.ThrowsAsync<ResourceConflictException>(() => context.SaveChangesAsync());
        Assert.Equal(ResourceConflictException.IntegrityConstraint, exception.Conflict);
    }

    private async Task AssertForeignKeyViolationAsync(Func<DiscWeaveDbContext, Task> arrangeAsync)
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync();
        await arrangeAsync(context);

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
    }

    private async Task<DiscWeaveDbContext> CreateInitializedContextAsync()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        DiscWeaveDbContext context = new(CreateOptions(connectionString));
        _ = await context.Database.EnsureCreatedAsync();

        return context;
    }

    private static DbContextOptions<DiscWeaveDbContext> CreateOptions(string connectionString)
    {
        return new DbContextOptionsBuilder<DiscWeaveDbContext>()
            .UseSqlite(connectionString)
            .Options;
    }

    private static LocalAudioFile CreateLocalAudioFile(CollectionId collectionId)
    {
        return LocalAudioFile.Create(
            collectionId,
            LocalAudioFileId.New(),
            FilePath.FromAbsolutePath("/music/New Order/Confusion.flac"));
    }
}
