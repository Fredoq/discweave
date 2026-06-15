using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class ReleaseImportRelationSuggestionPersistenceTests
{
    private static async Task<DiscWeaveDbContext> CreateInitializedContextAsync(string connectionString)
    {
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

    private static ReleaseImportRelationSuggestion CreateSuggestion(ImportGraph graph)
    {
        return ReleaseImportRelationSuggestion.Create(
            graph.CollectionId,
            graph.SessionId,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
                null,
                "editOf"));
    }

    private static async Task<ImportGraph> AddImportGraphAsync(DiscWeaveDbContext context, CollectionId collectionId)
    {
        await TestCollectionFactory.AddCollectionAsync(context, collectionId);
        var sessionId = ReleaseImportSessionId.New();
        var draftId = ReleaseImportDraftId.New();
        var draftTrackId = ReleaseImportDraftTrackId.New();
        var session = ReleaseImportSession.Create(collectionId, sessionId, "/imports", DateTimeOffset.UnixEpoch);
        var draft = ReleaseImportDraft.Create(collectionId, sessionId, draftId, "/imports/blue-monday", "blue-monday");
        ReleaseImportDraftTrack draftTrack = CreateDraftTrack(collectionId, draftId, draftTrackId, "Blue Monday (Radio Edit).flac");
        _ = context.ReleaseImportSessions.Add(session);
        _ = context.ReleaseImportDrafts.Add(draft);
        _ = context.ReleaseImportDraftTracks.Add(draftTrack);
        _ = await context.SaveChangesAsync();

        return new ImportGraph(collectionId, sessionId, draftId, draftTrackId);
    }

    private static ReleaseImportDraftTrack CreateDraftTrack(
        CollectionId collectionId,
        ReleaseImportDraftId draftId,
        ReleaseImportDraftTrackId draftTrackId,
        string relativePath)
    {
        var track = ReleaseImportDraftTrack.Create(
            collectionId,
            draftId,
            draftTrackId,
            new DraftTrackFileInfo(
                $"/imports/{relativePath}",
                relativePath,
                AudioFileFormat.Flac,
                123_456,
                DateTimeOffset.UnixEpoch,
                Optional.Missing<string>()));
        track.UpdateEditableFields(new DraftTrackEditableFields(
            Position: 1,
            Disc: null,
            Side: null,
            Title: Path.GetFileNameWithoutExtension(relativePath),
            Duration: TimeSpan.FromMinutes(4),
            InheritReleaseArtistCredits: true,
            IsSkipped: false,
            ArtistNames: [],
            ArtistCredits: [],
            SelectedArtistIds: [],
            SelectedTrackId: null,
            Issues: []));

        return track;
    }

    private sealed record ImportGraph(
        CollectionId CollectionId,
        ReleaseImportSessionId SessionId,
        ReleaseImportDraftId DraftId,
        ReleaseImportDraftTrackId DraftTrackId);
}
