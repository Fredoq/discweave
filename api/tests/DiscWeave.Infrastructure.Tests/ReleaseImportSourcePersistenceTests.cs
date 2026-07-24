using DiscWeave.Application.Errors;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class ReleaseImportSourcePersistenceTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ReleaseImportSourcePersistenceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Fresh SQLite import storage uses explicit source discriminants and collection-aware keys")]
    public async Task Fresh_SQLite_import_storage_uses_explicit_source_discriminants_and_collection_aware_keys()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);

        IEntityType sessionType = AssertEntityType<ReleaseImportSession>(context);
        IEntityType draftType = AssertEntityType<ReleaseImportDraft>(context);
        IEntityType trackType = AssertEntityType<ReleaseImportDraftTrack>(context);

        AssertRequiredLocalFilesDefault(sessionType);
        AssertRequiredLocalFilesDefault(draftType);
        AssertRequiredLocalFilesDefault(trackType);
        AssertCompositeForeignKey(
            draftType,
            typeof(ReleaseImportSession),
            ["CollectionId", "SessionId", "SourceKind"],
            ["CollectionId", "Id", "SourceKind"]);
        AssertCompositeForeignKey(
            trackType,
            typeof(ReleaseImportDraft),
            ["CollectionId", "DraftId", "SourceKind"],
            ["CollectionId", "Id", "SourceKind"]);
        Assert.Empty(context.Database.GetMigrations());
        Assert.DoesNotContain(
            typeof(DiscWeaveDbContext).Assembly.GetTypes(),
            type => type.Name.Contains("SqliteSchemaUpgrader", StringComparison.Ordinal));
    }

    [Fact(DisplayName = "Fresh SQLite round-trips local descriptors and leaves external file columns null")]
    public async Task Fresh_SQLite_round_trips_local_descriptors_and_leaves_external_file_columns_null()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        var collectionId = CollectionId.New();
        var localSessionId = ReleaseImportSessionId.New();
        var externalSessionId = ReleaseImportSessionId.New();
        var localDraftId = ReleaseImportDraftId.New();
        var externalDraftId = ReleaseImportDraftId.New();
        var localTrackId = ReleaseImportDraftTrackId.New();
        var externalTrackId = ReleaseImportDraftTrackId.New();
        DateTimeOffset createdAt = new(2026, 7, 24, 9, 30, 0, TimeSpan.Zero);
        DateTimeOffset lastModifiedAt = new(2026, 7, 23, 18, 15, 0, TimeSpan.Zero);
        var localDescriptor = ReleaseImportLocalFileDescriptor.Create(
            new DraftTrackFileInfo(
                "/music/Local Release/01 Track.flac",
                "Local Release/01 Track.flac",
                AudioFileFormat.Flac,
                12_345_678,
                lastModifiedAt,
                Optional.From("ABCDEF012345"),
                new DraftTrackFileMetadata(
                    Optional.From("FLAC"),
                    Optional.From(AudioFileQuality.Lossless),
                    Optional.From(1_411),
                    Optional.From(96_000),
                    Optional.From(2))));

        await using (DiscWeaveDbContext writeContext = await CreateInitializedContextAsync(connectionString))
        {
            await TestCollectionFactory.AddCollectionAsync(writeContext, collectionId);
            _ = writeContext.ReleaseImportSessions.Add(
                ReleaseImportSession.Create(collectionId, localSessionId, "/music", createdAt));
            _ = writeContext.ReleaseImportSessions.Add(
                ReleaseImportSession.CreateExternalMetadata(collectionId, externalSessionId, createdAt));
            _ = writeContext.ReleaseImportDrafts.Add(
                ReleaseImportDraft.Create(
                    collectionId,
                    localSessionId,
                    localDraftId,
                    "/music/Local Release",
                    "Local Release"));
            _ = writeContext.ReleaseImportDrafts.Add(
                ReleaseImportDraft.CreateExternalMetadata(collectionId, externalSessionId, externalDraftId));
            _ = writeContext.ReleaseImportDraftTracks.Add(
                ReleaseImportDraftTrack.CreateLocalFile(collectionId, localDraftId, localTrackId, localDescriptor));
            _ = writeContext.ReleaseImportDraftTracks.Add(
                ReleaseImportDraftTrack.CreateExternalMetadata(collectionId, externalDraftId, externalTrackId));

            _ = await writeContext.SaveChangesAsync();
        }

        await using (DiscWeaveDbContext readContext = new(CreateOptions(connectionString)))
        {
            ReleaseImportSession localSession = await readContext.ReleaseImportSessions.SingleAsync(session => session.Id == localSessionId);
            ReleaseImportSession externalSession = await readContext.ReleaseImportSessions.SingleAsync(session => session.Id == externalSessionId);
            ReleaseImportDraft localDraft = await readContext.ReleaseImportDrafts.SingleAsync(draft => draft.Id == localDraftId);
            ReleaseImportDraft externalDraft = await readContext.ReleaseImportDrafts.SingleAsync(draft => draft.Id == externalDraftId);
            ReleaseImportDraftTrack localTrack = await readContext.ReleaseImportDraftTracks.SingleAsync(track => track.Id == localTrackId);
            ReleaseImportDraftTrack externalTrack = await readContext.ReleaseImportDraftTracks.SingleAsync(track => track.Id == externalTrackId);

            Assert.Equal(ReleaseImportSourceKind.LocalFiles, localSession.SourceKind);
            Assert.Equal(ReleaseImportSourceKind.LocalFiles, localDraft.SourceKind);
            Assert.Equal(ReleaseImportSourceKind.LocalFiles, localTrack.SourceKind);
            Assert.Equal(ReleaseImportSourceKind.ExternalMetadata, externalSession.SourceKind);
            Assert.Equal(ReleaseImportSourceKind.ExternalMetadata, externalDraft.SourceKind);
            Assert.Equal(ReleaseImportSourceKind.ExternalMetadata, externalTrack.SourceKind);
            Assert.Equal("/music", Assert.IsType<PresentOptionalValue<string>>(localSession.SourceRoot).Value);
            Assert.Equal(ReleaseImportScanMode.Full, Assert.IsType<PresentOptionalValue<ReleaseImportScanMode>>(localSession.ScanMode).Value);
            Assert.Equal("/music/Local Release", Assert.IsType<PresentOptionalValue<string>>(localDraft.SourcePath).Value);
            Assert.Equal("Local Release", Assert.IsType<PresentOptionalValue<string>>(localDraft.RelativePath).Value);
            _ = Assert.IsType<MissingOptionalValue<string>>(externalSession.SourceRoot);
            _ = Assert.IsType<MissingOptionalValue<ReleaseImportScanMode>>(externalSession.ScanMode);
            _ = Assert.IsType<MissingOptionalValue<string>>(externalDraft.SourcePath);
            _ = Assert.IsType<MissingOptionalValue<string>>(externalDraft.RelativePath);

            ReleaseImportLocalFileDescriptor actualLocalFile =
                Assert.IsType<PresentOptionalValue<ReleaseImportLocalFileDescriptor>>(localTrack.LocalFile).Value;
            Assert.Equal(localDescriptor.FilePath, actualLocalFile.FilePath);
            Assert.Equal(localDescriptor.RelativePath, actualLocalFile.RelativePath);
            Assert.Equal(localDescriptor.Format, actualLocalFile.Format);
            Assert.Equal(localDescriptor.SizeBytes, actualLocalFile.SizeBytes);
            Assert.Equal(localDescriptor.LastModifiedAt, actualLocalFile.LastModifiedAt);
            Assert.Equal("abcdef012345", Assert.IsType<PresentOptionalValue<string>>(actualLocalFile.ContentHash).Value);
            Assert.Equal("FLAC", Assert.IsType<PresentOptionalValue<string>>(actualLocalFile.Codec).Value);
            Assert.Equal(AudioFileQuality.Lossless, Assert.IsType<PresentOptionalValue<AudioFileQuality>>(actualLocalFile.Quality).Value);
            Assert.Equal(1_411, Assert.IsType<PresentOptionalValue<int>>(actualLocalFile.BitrateKbps).Value);
            Assert.Equal(96_000, Assert.IsType<PresentOptionalValue<int>>(actualLocalFile.SampleRateHz).Value);
            Assert.Equal(2, Assert.IsType<PresentOptionalValue<int>>(actualLocalFile.Channels).Value);
            _ = Assert.IsType<MissingOptionalValue<ReleaseImportLocalFileDescriptor>>(externalTrack.LocalFile);
        }

        await AssertExternalColumnsAreNullAsync(connectionString, externalSessionId, externalDraftId, externalTrackId);
    }

    [Fact(DisplayName = "Scoped SQLite round-trips a sparse local file descriptor")]
    public async Task Scoped_SQLite_round_trips_a_sparse_local_file_descriptor()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        var collectionId = CollectionId.New();
        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();
        var trackId = ReleaseImportDraftTrackId.New();
        DateTimeOffset createdAt = new(2026, 7, 24, 9, 30, 0, TimeSpan.Zero);
        DateTimeOffset lastModifiedAt = new(2026, 7, 23, 18, 15, 0, TimeSpan.Zero);
        var sparseDescriptor = ReleaseImportLocalFileDescriptor.Create(
            new DraftTrackFileInfo(
                "/music/Sparse Release/01 Track.flac",
                "Sparse Release/01 Track.flac",
                AudioFileFormat.Flac,
                12_345_678,
                lastModifiedAt,
                Optional.Missing<string>(),
                new DraftTrackFileMetadata(
                    Optional.Missing<string>(),
                    Optional.Missing<AudioFileQuality>(),
                    Optional.Missing<int>(),
                    Optional.Missing<int>(),
                    Optional.Missing<int>())));

        await using (DiscWeaveDbContext writeContext = await CreateInitializedContextAsync(connectionString))
        {
            await TestCollectionFactory.AddCollectionAsync(writeContext, collectionId);
            _ = writeContext.ReleaseImportSessions.Add(
                ReleaseImportSession.Create(collectionId, sessionId, "/music", createdAt));
            _ = writeContext.ReleaseImportDrafts.Add(
                ReleaseImportDraft.Create(
                    collectionId,
                    sessionId,
                    draftId,
                    "/music/Sparse Release",
                    "Sparse Release"));
            _ = writeContext.ReleaseImportDraftTracks.Add(
                ReleaseImportDraftTrack.CreateLocalFile(collectionId, draftId, trackId, sparseDescriptor));
            _ = await writeContext.SaveChangesAsync();
        }

        await using var readContext = new DiscWeaveDbContext(
            CreateOptions(connectionString),
            new TestCurrentCollection(collectionId));
        IEntityType descriptorType = AssertEntityType<ReleaseImportLocalFileDescriptor>(readContext);
        foreach (string propertyName in new string[]
                 {
                     nameof(ReleaseImportLocalFileDescriptor.FilePath),
                     nameof(ReleaseImportLocalFileDescriptor.RelativePath),
                     nameof(ReleaseImportLocalFileDescriptor.Format),
                     nameof(ReleaseImportLocalFileDescriptor.SizeBytes),
                     nameof(ReleaseImportLocalFileDescriptor.LastModifiedAt)
                 })
        {
            Assert.False(
                Assert.IsAssignableFrom<IProperty>(descriptorType.FindProperty(propertyName)).IsNullable,
                $"Expected {propertyName} to be required");
        }

        foreach (string propertyName in new string[]
                 {
                     nameof(ReleaseImportLocalFileDescriptor.ContentHash),
                     nameof(ReleaseImportLocalFileDescriptor.Codec),
                     nameof(ReleaseImportLocalFileDescriptor.Quality),
                     nameof(ReleaseImportLocalFileDescriptor.BitrateKbps),
                     nameof(ReleaseImportLocalFileDescriptor.SampleRateHz),
                     nameof(ReleaseImportLocalFileDescriptor.Channels)
                 })
        {
            Assert.True(
                Assert.IsAssignableFrom<IProperty>(descriptorType.FindProperty(propertyName)).IsNullable,
                $"Expected {propertyName} to be nullable");
        }

        ReleaseImportDraftTrack track = await readContext.ReleaseImportDraftTracks.SingleAsync(candidate => candidate.Id == trackId);
        ReleaseImportLocalFileDescriptor actual =
            Assert.IsType<PresentOptionalValue<ReleaseImportLocalFileDescriptor>>(track.LocalFile).Value;
        Assert.Equal(sparseDescriptor.FilePath, actual.FilePath);
        Assert.Equal(sparseDescriptor.RelativePath, actual.RelativePath);
        Assert.Equal(sparseDescriptor.Format, actual.Format);
        Assert.Equal(sparseDescriptor.SizeBytes, actual.SizeBytes);
        Assert.Equal(sparseDescriptor.LastModifiedAt, actual.LastModifiedAt);
    }

    [Fact(DisplayName = "SQLite rejects a draft whose source kind differs from its session")]
    public async Task SQLite_rejects_a_draft_whose_source_kind_differs_from_its_session()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);
        var collectionId = CollectionId.New();
        var sessionId = ReleaseImportSessionId.New();
        await TestCollectionFactory.AddCollectionAsync(context, collectionId);
        _ = context.ReleaseImportSessions.Add(
            ReleaseImportSession.Create(collectionId, sessionId, "/music", DateTimeOffset.UnixEpoch));
        _ = await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        _ = context.ReleaseImportDrafts.Add(
            ReleaseImportDraft.CreateExternalMetadata(collectionId, sessionId, ReleaseImportDraftId.New()));

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
    }

    [Fact(DisplayName = "SQLite rejects a track whose source kind differs from its draft")]
    public async Task SQLite_rejects_a_track_whose_source_kind_differs_from_its_draft()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);
        var collectionId = CollectionId.New();
        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();
        await TestCollectionFactory.AddCollectionAsync(context, collectionId);
        _ = context.ReleaseImportSessions.Add(
            ReleaseImportSession.Create(collectionId, sessionId, "/music", DateTimeOffset.UnixEpoch));
        _ = context.ReleaseImportDrafts.Add(
            ReleaseImportDraft.Create(collectionId, sessionId, draftId, "/music/release", "release"));
        _ = await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        _ = context.ReleaseImportDraftTracks.Add(
            ReleaseImportDraftTrack.CreateExternalMetadata(collectionId, draftId, ReleaseImportDraftTrackId.New()));

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
    }

}
