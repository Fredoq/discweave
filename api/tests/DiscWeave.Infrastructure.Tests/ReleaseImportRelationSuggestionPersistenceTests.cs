using DiscWeave.Application.Errors;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed class ReleaseImportRelationSuggestionPersistenceTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ReleaseImportRelationSuggestionPersistenceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Release import relation suggestion persists structured endpoint references beside payload snapshots")]
    public async Task Release_import_relation_suggestion_persists_structured_endpoint_references_beside_payload_snapshots()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        var existingTrack = Track.Create(graph.CollectionId, TrackId.New(), "Blue Monday");
        _ = context.Tracks.Add(existingTrack);
        var reviewedDraftTrackId = ReleaseImportDraftTrackId.New();
        ReleaseImportDraftTrack reviewedDraftTrack = CreateDraftTrack(graph.CollectionId, graph.DraftId, reviewedDraftTrackId, "Blue Monday (Dub).flac");
        _ = context.ReleaseImportDraftTracks.Add(reviewedDraftTrack);
        var suggestion = ReleaseImportRelationSuggestion.Create(
            graph.CollectionId,
            graph.SessionId,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            " radio-edit ",
            82,
            new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
                ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(existingTrack.Id),
                " editOf "));
        suggestion.Accept(new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(reviewedDraftTrackId),
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
            " versionOf "));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await context.SaveChangesAsync();

        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText =
            """
            SELECT token,
                   suggested_source_kind,
                   suggested_source_track_id,
                   suggested_target_kind,
                   suggested_target_track_id,
                   suggested_relation_type_code,
                   reviewed_source_kind,
                   reviewed_source_track_id,
                   reviewed_target_kind,
                   reviewed_target_track_id,
            reviewed_relation_type_code,
            suggested_payload_json,
            reviewed_payload_json
            FROM release_import_relation_suggestions
            LIMIT 1;
            """;
        await using SqliteDataReader reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        Assert.Equal("radio-edit", reader.GetString(0));
        Assert.Equal("DraftTrack", reader.GetString(1));
        Assert.Equal(graph.DraftTrackId.Value, Guid.Parse(reader.GetString(2)));
        Assert.Equal("ExistingTrack", reader.GetString(3));
        Assert.Equal(existingTrack.Id.Value, Guid.Parse(reader.GetString(4)));
        Assert.Equal("editOf", reader.GetString(5));
        Assert.Equal("DraftTrack", reader.GetString(6));
        Assert.Equal(reviewedDraftTrackId.Value, Guid.Parse(reader.GetString(7)));
        Assert.Equal("DraftTrack", reader.GetString(8));
        Assert.Equal(graph.DraftTrackId.Value, Guid.Parse(reader.GetString(9)));
        Assert.Equal("versionOf", reader.GetString(10));
        Assert.Contains("editOf", reader.GetString(11), StringComparison.Ordinal);
        Assert.Contains("versionOf", reader.GetString(12), StringComparison.Ordinal);
    }

    [Fact(DisplayName = "Release import relation suggestion queries are filtered by current collection")]
    public async Task Release_import_relation_suggestion_queries_are_filtered_by_current_collection()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        var firstCollectionId = CollectionId.New();
        await using (DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString))
        {
            ImportGraph first = await AddImportGraphAsync(context, firstCollectionId);
            ImportGraph second = await AddImportGraphAsync(context, CollectionId.New());
            _ = context.ReleaseImportRelationSuggestions.Add(CreateSuggestion(first));
            _ = context.ReleaseImportRelationSuggestions.Add(CreateSuggestion(second));
            _ = await context.SaveChangesAsync();
        }

        await using DiscWeaveDbContext filteredContext = new(CreateOptions(connectionString), new TestCurrentCollection(firstCollectionId));
        ReleaseImportRelationSuggestion[] suggestions = [.. await filteredContext.ReleaseImportRelationSuggestions.ToListAsync()];

        ReleaseImportRelationSuggestion suggestion = Assert.Single(suggestions);
        Assert.Equal(firstCollectionId, suggestion.CollectionId);
    }

    [Fact(DisplayName = "Release import relation suggestion is deleted when its draft is deleted")]
    public async Task Release_import_relation_suggestion_is_deleted_when_its_draft_is_deleted()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        _ = context.ReleaseImportRelationSuggestions.Add(CreateSuggestion(graph));
        _ = await context.SaveChangesAsync();

        ReleaseImportDraft draft = await context.ReleaseImportDrafts.SingleAsync(draft => draft.Id == graph.DraftId);
        _ = context.ReleaseImportDrafts.Remove(draft);
        _ = await context.SaveChangesAsync();

        Assert.Empty(await context.ReleaseImportRelationSuggestions.IgnoreQueryFilters().ToListAsync());
    }

    [Fact(DisplayName = "Release import relation suggestion fails when session does not match draft")]
    public async Task Release_import_relation_suggestion_fails_when_session_does_not_match_draft()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(await _sqlite.CreateDatabaseAsync());
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        var otherSession = ReleaseImportSession.Create(graph.CollectionId, ReleaseImportSessionId.New(), "/imports/other", DateTimeOffset.UnixEpoch);
        _ = context.ReleaseImportSessions.Add(otherSession);
        _ = await context.SaveChangesAsync();
        var suggestion = ReleaseImportRelationSuggestion.Create(
            graph.CollectionId,
            otherSession.Id,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
                null,
                "editOf"));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
    }

    [Fact(DisplayName = "Release import relation suggestion fails when source draft track is missing")]
    public async Task Release_import_relation_suggestion_fails_when_source_draft_track_is_missing()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(await _sqlite.CreateDatabaseAsync());
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        var suggestion = ReleaseImportRelationSuggestion.Create(
            graph.CollectionId,
            graph.SessionId,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(ReleaseImportDraftTrackId.New()),
                null,
                "editOf"));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
    }

    [Fact(DisplayName = "Release import relation suggestion fails when existing target track is from another collection")]
    public async Task Release_import_relation_suggestion_fails_when_existing_target_track_is_from_another_collection()
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(await _sqlite.CreateDatabaseAsync());
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        var otherCollectionId = CollectionId.New();
        await TestCollectionFactory.AddCollectionAsync(context, otherCollectionId);
        var otherTrack = Track.Create(otherCollectionId, TrackId.New(), "Blue Monday");
        _ = context.Tracks.Add(otherTrack);
        _ = await context.SaveChangesAsync();
        var suggestion = ReleaseImportRelationSuggestion.Create(
            graph.CollectionId,
            graph.SessionId,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
                ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(otherTrack.Id),
                "editOf"));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
    }

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

    private sealed class TestCurrentCollection : ICurrentCollection
    {
        public TestCurrentCollection(CollectionId collectionId)
        {
            CollectionId = collectionId;
        }

        public CollectionId CollectionId { get; }
    }
}
