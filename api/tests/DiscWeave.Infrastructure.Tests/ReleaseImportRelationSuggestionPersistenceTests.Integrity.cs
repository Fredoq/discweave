using DiscWeave.Application.Errors;
using DiscWeave.Application.Security;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class ReleaseImportRelationSuggestionPersistenceTests
{
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

    [Fact(DisplayName = "Release import relation suggestion can target a draft track from another draft in the session")]
    public async Task Release_import_relation_suggestion_can_target_a_draft_track_from_another_draft_in_the_session()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        var otherDraftId = ReleaseImportDraftId.New();
        var otherDraftTrackId = ReleaseImportDraftTrackId.New();
        var otherDraft = ReleaseImportDraft.Create(graph.CollectionId, graph.SessionId, otherDraftId, "/imports/blue-monday-base", "blue-monday-base");
        ReleaseImportDraftTrack otherDraftTrack = CreateDraftTrack(graph.CollectionId, otherDraftId, otherDraftTrackId, "Blue Monday.flac");
        _ = context.ReleaseImportDrafts.Add(otherDraft);
        _ = context.ReleaseImportDraftTracks.Add(otherDraftTrack);
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
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(otherDraftTrackId),
                "versionOf"));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await context.SaveChangesAsync();

        ReleaseImportRelationSuggestion saved = await context.ReleaseImportRelationSuggestions.AsNoTracking().SingleAsync();
        Assert.Equal(otherDraftTrackId.Value, saved.SuggestedPayload.Target!.TrackId);
    }

    [Theory(DisplayName = "Release import relation suggestion rejects suggested and reviewed draft sources from another draft")]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Release_import_relation_suggestion_rejects_suggested_and_reviewed_draft_sources_from_another_draft(
        bool useForeignSourceOnlyForReviewedPayload)
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(await _sqlite.CreateDatabaseAsync());
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        var otherDraftId = ReleaseImportDraftId.New();
        var otherDraftTrackId = ReleaseImportDraftTrackId.New();
        _ = context.ReleaseImportDrafts.Add(ReleaseImportDraft.Create(
            graph.CollectionId,
            graph.SessionId,
            otherDraftId,
            "/imports/other-source",
            "other-source"));
        _ = context.ReleaseImportDraftTracks.Add(
            CreateDraftTrack(graph.CollectionId, otherDraftId, otherDraftTrackId, "Other Source.flac"));
        _ = await context.SaveChangesAsync();
        var validPayload = new ReleaseImportRelationSuggestionPayload(
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
            "versionOf");
        ReleaseImportRelationSuggestionPayload foreignSourcePayload = validPayload with
        {
            Source = ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(otherDraftTrackId)
        };
        var suggestion = ReleaseImportRelationSuggestion.Create(
            graph.CollectionId,
            graph.SessionId,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            useForeignSourceOnlyForReviewedPayload ? validPayload : foreignSourcePayload);
        if (useForeignSourceOnlyForReviewedPayload)
        {
            suggestion.Accept(foreignSourcePayload);
        }
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
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
                "versionOf"));
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
                "versionOf"));
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
                "versionOf"));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
    }

    [Theory(DisplayName = "Release import relation suggestion rejects missing or foreign existing track endpoints")]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task Release_import_relation_suggestion_rejects_missing_or_foreign_existing_track_endpoints(
        bool isSource,
        bool isForeign)
    {
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(await _sqlite.CreateDatabaseAsync());
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        TrackId invalidTrackId;
        if (isForeign)
        {
            var foreignCollectionId = CollectionId.New();
            await TestCollectionFactory.AddCollectionAsync(context, foreignCollectionId);
            var foreignTrack = Track.Create(foreignCollectionId, TrackId.New(), "Blue Monday");
            _ = context.Tracks.Add(foreignTrack);
            _ = await context.SaveChangesAsync();
            invalidTrackId = foreignTrack.Id;
        }
        else
        {
            invalidTrackId = TrackId.New();
        }

        var invalidEndpoint =
            ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(invalidTrackId);
        var draftEndpoint =
            ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId);
        var suggestion = ReleaseImportRelationSuggestion.Create(
            graph.CollectionId,
            graph.SessionId,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            new ReleaseImportRelationSuggestionPayload(
                isSource ? invalidEndpoint : draftEndpoint,
                isSource ? draftEndpoint : invalidEndpoint,
                "versionOf"));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await Assert.ThrowsAsync<ReferencedResourceMissingException>(() => context.SaveChangesAsync());
    }

    private sealed class TestCurrentCollection : ICurrentCollection
    {
        public TestCurrentCollection(CollectionId collectionId)
        {
            CollectionId = collectionId;
        }

        public CollectionId CollectionId { get; }
    }

    public enum EndpointStorageColumn
    {
        SuggestedSource,
        ReviewedSource,
        SuggestedTarget,
        ReviewedTarget
    }
}
