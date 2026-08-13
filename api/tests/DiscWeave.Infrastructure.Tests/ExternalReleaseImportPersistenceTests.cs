using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class ExternalReleaseImportPersistenceTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ExternalReleaseImportPersistenceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "SQLite round-trips external idempotency and timestamp-free provider provenance")]
    public async Task SQLite_round_trips_external_idempotency_and_timestamp_free_provider_provenance()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        var collectionId = CollectionId.New();
        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();
        var rowId = ReleaseImportDraftTrackId.New();
        var sourceTrackId = TrackId.New();
        var selectedTrackId = TrackId.New();
        var selectedReleaseId = ReleaseId.New();
        var releaseSource = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "release",
            "33333333-3333-3333-3333-333333333333",
            "https://musicbrainz.org/release/33333333-3333-3333-3333-333333333333");
        var recordingSource = ReleaseImportProviderReference.Create(
            "musicbrainz",
            "recording",
            "22222222-2222-2222-2222-222222222222",
            "https://musicbrainz.org/recording/22222222-2222-2222-2222-222222222222");

        await using (DiscWeaveDbContext writeContext = await CreateContextAsync(connectionString))
        {
            await TestCollectionFactory.AddCollectionAsync(writeContext, collectionId);
            var session = ReleaseImportSession.CreateExternalMetadata(
                collectionId,
                sessionId,
                " request-key ",
                new string('a', 64),
                DateTimeOffset.UnixEpoch);
            var draft = ReleaseImportDraft.CreateExternalMetadata(collectionId, sessionId, draftId);
            var row = ReleaseImportDraftTrack.CreateExternalMetadata(collectionId, draftId, rowId);
            var musicBrainzRow = MusicBrainzReleaseRowLocator.Create(
                releaseSource.ExternalId,
                "1",
                "44444444-4444-4444-4444-444444444444");
            var binding = SelectedOriginalBinding.CreateMusicBrainz(
                sourceTrackId,
                rowId,
                recordingSource,
                ExternalReleaseRoute.CreateMusicBrainz(releaseSource),
                musicBrainzRow,
                false);
            var selectedRelease = Release.Create(collectionId, selectedReleaseId, "Selected release");
            var sourceTrack = Track.Create(collectionId, sourceTrackId, "Source track");
            var selectedTrack = Track.Create(collectionId, selectedTrackId, "Selected track");
            _ = writeContext.Releases.Add(selectedRelease);
            writeContext.Tracks.AddRange(sourceTrack, selectedTrack);
            draft.UnionAuthoritativeExternalSources([releaseSource]);
            row.UnionAuthoritativeExternalSources([recordingSource]);
            _ = writeContext.ReleaseImportSessions.Add(session);
            _ = writeContext.ReleaseImportDrafts.Add(draft);
            _ = writeContext.ReleaseImportDraftTracks.Add(row);
            _ = await writeContext.SaveChangesAsync();
            draft.InitializeExternalReview(
                binding,
                ReleaseImportCollectionItemIntent.NewWanted.WithMedium(
                    ReleaseImportMediumIntent.Digital.Create()),
                row);
            draft.AuthoritativelySelectLocalRelease(selectedReleaseId);
            draft.AuthoritativelySelectLocalTrack(selectedTrackId);
            _ = await writeContext.SaveChangesAsync();
        }

        await using var readContext = new DiscWeaveDbContext(CreateOptions(connectionString));
        ReleaseImportSession persistedSession = await readContext.ReleaseImportSessions.SingleAsync();
        ReleaseImportDraft persistedDraft = await readContext.ReleaseImportDrafts.SingleAsync();
        ReleaseImportDraftTrack persistedRow = await readContext.ReleaseImportDraftTracks.SingleAsync();

        Assert.Equal("request-key", Assert.IsType<PresentOptionalValue<string>>(persistedSession.IdempotencyKey).Value);
        Assert.Equal(new string('a', 64), Assert.IsType<PresentOptionalValue<string>>(
            persistedSession.IdempotencyRequestFingerprint).Value);
        Assert.Equal("musicbrainz", Assert.Single(persistedDraft.ExternalSources).ProviderCode);
        Assert.Equal("recording", Assert.Single(persistedRow.ExternalSources).ResourceType);
        SelectedOriginalBinding persistedBinding = Assert.IsType<PresentOptionalValue<SelectedOriginalBinding>>(
            persistedDraft.SelectedOriginalBinding).Value;
        Assert.Equal(sourceTrackId, persistedBinding.SourceTrackId);
        Assert.Equal(rowId, persistedBinding.DraftTrackId);
        Assert.True(persistedDraft.IsSelectedOriginalBindingValid);
        Assert.Equal(2, persistedDraft.ExternalReviewRevision);
        ReleaseImportCollectionItemIntent.NewWanted persistedIntent =
            Assert.IsType<ReleaseImportCollectionItemIntent.NewWanted>(
            Assert.IsType<PresentOptionalValue<ReleaseImportCollectionItemIntent>>(
                persistedDraft.CollectionItemIntent).Value);
        Assert.Equal("digital", Assert.IsType<PresentOptionalValue<ReleaseImportMediumIntent>>(
            persistedIntent.Medium).Value.CanonicalKey);
        ReleaseImportLocalProvenanceSelection persistedSelection =
            Assert.IsType<PresentOptionalValue<ReleaseImportLocalProvenanceSelection>>(
            persistedDraft.LocalProvenanceSelection).Value;
        Assert.Equal(selectedReleaseId, Assert.IsType<PresentOptionalValue<ReleaseId>>(
            persistedSelection.SelectedReleaseId).Value);
        Assert.Equal(selectedTrackId, Assert.IsType<PresentOptionalValue<TrackId>>(
            persistedSelection.SelectedTrackId).Value);
        Assert.True(persistedRow.IsOriginal);
    }

    private static async Task<DiscWeaveDbContext> CreateContextAsync(string connectionString)
    {
        var context = new DiscWeaveDbContext(CreateOptions(connectionString));
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
