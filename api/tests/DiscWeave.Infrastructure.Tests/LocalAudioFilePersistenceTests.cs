using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class LocalAudioFilePersistenceTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public LocalAudioFilePersistenceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "One local audio file can be linked by multiple digital release copies")]
    public async Task One_local_audio_file_can_be_linked_by_multiple_digital_release_copies()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync();
        var collectionId = CollectionId.New();
        await TestCollectionFactory.AddCollectionAsync(context, collectionId);
        var track = Track.Create(collectionId, TrackId.New(), "Blue Monday");
        var firstReleaseTrackId = ReleaseTrackId.New();
        var secondReleaseTrackId = ReleaseTrackId.New();
        Release firstRelease = Release.Create(collectionId, ReleaseId.New(), "Blue Monday")
            .WithTrack(ReleaseTrack.Create(firstReleaseTrackId, track.Id, TrackPosition.FromNumber(1)));
        Release secondRelease = Release.Create(collectionId, ReleaseId.New(), "Substance")
            .WithTrack(ReleaseTrack.Create(secondReleaseTrackId, track.Id, TrackPosition.FromNumber(5)));
        var firstCopy = OwnedItem.Create(collectionId, OwnedItemId.New(), firstRelease.Id, OwnershipStatus.Owned, DigitalFile.Create());
        var secondCopy = OwnedItem.Create(collectionId, OwnedItemId.New(), secondRelease.Id, OwnershipStatus.Owned, DigitalFile.Create());
        LocalAudioFile file = LocalAudioFile.Create(
                collectionId,
                LocalAudioFileId.New(),
                FilePath.FromAbsolutePath("/music/New Order/Blue Monday.flac"))
            .WithFormat(AudioFileFormat.Flac)
            .WithQuality(AudioFileQuality.Lossless)
            .WithContentHash("ABCDEF");

        _ = context.Tracks.Add(track);
        _ = context.Releases.Add(firstRelease);
        _ = context.Releases.Add(secondRelease);
        _ = context.OwnedItems.Add(firstCopy);
        _ = context.OwnedItems.Add(secondCopy);
        _ = context.LocalAudioFiles.Add(file);
        _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
            collectionId,
            DigitalTrackFileLinkId.New(),
            firstCopy.Id,
            firstReleaseTrackId,
            file.Id));
        _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
            collectionId,
            DigitalTrackFileLinkId.New(),
            secondCopy.Id,
            secondReleaseTrackId,
            file.Id));
        _ = await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        DigitalTrackFileLink[] links = [.. (await context.DigitalTrackFileLinks.ToArrayAsync())
            .OrderBy(link => link.ReleaseTrackId.Value)];
        LocalAudioFile actualFile = await context.LocalAudioFiles.SingleAsync();

        Assert.Equal(2, links.Length);
        Assert.All(links, link => Assert.Equal(file.Id, link.LocalAudioFileId));
        Assert.Equal("abcdef", Assert.IsType<PresentOptionalValue<string>>(actualFile.ContentHash).Value);
    }

    [Fact(DisplayName = "One logical track can resolve to different files through release appearances")]
    public async Task One_logical_track_can_resolve_to_different_files_through_release_appearances()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync();
        var collectionId = CollectionId.New();
        await TestCollectionFactory.AddCollectionAsync(context, collectionId);
        var track = Track.Create(collectionId, TrackId.New(), "Confusion");
        var firstReleaseTrackId = ReleaseTrackId.New();
        var secondReleaseTrackId = ReleaseTrackId.New();
        Release firstRelease = Release.Create(collectionId, ReleaseId.New(), "Confusion")
            .WithTrack(ReleaseTrack.Create(firstReleaseTrackId, track.Id, TrackPosition.FromNumber(1)));
        Release secondRelease = Release.Create(collectionId, ReleaseId.New(), "Confusion Remixes")
            .WithTrack(ReleaseTrack.Create(secondReleaseTrackId, track.Id, TrackPosition.FromNumber(2)));
        var firstCopy = OwnedItem.Create(collectionId, OwnedItemId.New(), firstRelease.Id, OwnershipStatus.Owned, DigitalFile.Create());
        var secondCopy = OwnedItem.Create(collectionId, OwnedItemId.New(), secondRelease.Id, OwnershipStatus.Owned, DigitalFile.Create());
        var firstFile = LocalAudioFile.Create(
            collectionId,
            LocalAudioFileId.New(),
            FilePath.FromAbsolutePath("/music/confusion/original.flac"));
        var secondFile = LocalAudioFile.Create(
            collectionId,
            LocalAudioFileId.New(),
            FilePath.FromAbsolutePath("/music/confusion/remix.flac"));

        _ = context.Tracks.Add(track);
        _ = context.Releases.Add(firstRelease);
        _ = context.Releases.Add(secondRelease);
        _ = context.OwnedItems.Add(firstCopy);
        _ = context.OwnedItems.Add(secondCopy);
        context.LocalAudioFiles.AddRange(firstFile, secondFile);
        context.DigitalTrackFileLinks.AddRange(
            DigitalTrackFileLink.Create(collectionId, DigitalTrackFileLinkId.New(), firstCopy.Id, firstReleaseTrackId, firstFile.Id),
            DigitalTrackFileLink.Create(collectionId, DigitalTrackFileLinkId.New(), secondCopy.Id, secondReleaseTrackId, secondFile.Id));
        _ = await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        Dictionary<ReleaseTrackId, LocalAudioFileId> filesByReleaseTrack = await context.DigitalTrackFileLinks
            .ToDictionaryAsync(link => link.ReleaseTrackId, link => link.LocalAudioFileId);

        Assert.Equal(firstFile.Id, filesByReleaseTrack[firstReleaseTrackId]);
        Assert.Equal(secondFile.Id, filesByReleaseTrack[secondReleaseTrackId]);
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
}
