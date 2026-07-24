using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class ReleaseImportRelationSuggestionPersistenceTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ReleaseImportRelationSuggestionPersistenceTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Release import relation suggestion application modes survive SQLite round trips")]
    public async Task Release_import_relation_suggestion_application_modes_survive_SQLite_round_trips()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        ReleaseImportRelationSuggestion bestEffort = CreateSuggestion(graph);
        var required = ReleaseImportRelationSuggestion.CreateRequired(
            graph.CollectionId,
            graph.SessionId,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            "original-discovery",
            100,
            bestEffort.SuggestedPayload);
        context.ReleaseImportRelationSuggestions.AddRange(bestEffort, required);

        _ = await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        ReleaseImportRelationSuggestion[] saved = await context.ReleaseImportRelationSuggestions
            .AsNoTracking()
            .OrderBy(suggestion => suggestion.ApplicationMode)
            .ToArrayAsync();

        Assert.Collection(
            saved,
            suggestion => Assert.Equal(ReleaseImportRelationSuggestionApplicationMode.BestEffort, suggestion.ApplicationMode),
            suggestion => Assert.Equal(ReleaseImportRelationSuggestionApplicationMode.Required, suggestion.ApplicationMode));
    }

    [Fact(DisplayName = "Release import relation suggestion application mode is required with a BestEffort compatibility default")]
    public async Task Release_import_relation_suggestion_application_mode_is_required_with_a_BestEffort_compatibility_default()
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);

        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync();
        await using SqliteCommand command = connection.CreateCommand();
        command.CommandText = "PRAGMA table_info('release_import_relation_suggestions');";
        await using SqliteDataReader reader = await command.ExecuteReaderAsync();

        bool found = false;
        while (await reader.ReadAsync())
        {
            if (!string.Equals(reader.GetString(1), "application_mode", StringComparison.Ordinal))
            {
                continue;
            }

            found = true;
            Assert.Equal("TEXT", reader.GetString(2));
            Assert.Equal(1, reader.GetInt32(3));
            Assert.Equal("'BestEffort'", reader.GetString(4));
        }

        Assert.True(found);
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
                " versionOf "));
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
        Assert.Equal("versionOf", reader.GetString(5));
        Assert.Equal("DraftTrack", reader.GetString(6));
        Assert.Equal(reviewedDraftTrackId.Value, Guid.Parse(reader.GetString(7)));
        Assert.Equal("DraftTrack", reader.GetString(8));
        Assert.Equal(graph.DraftTrackId.Value, Guid.Parse(reader.GetString(9)));
        Assert.Equal("versionOf", reader.GetString(10));
        Assert.Contains("versionOf", reader.GetString(11), StringComparison.Ordinal);
        Assert.Contains("versionOf", reader.GetString(12), StringComparison.Ordinal);
    }

    [Theory(DisplayName = "Release import relation suggestion reloads every typed source and target endpoint pair")]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task Release_import_relation_suggestion_reloads_every_typed_source_and_target_endpoint_pair(
        bool sourceIsExisting,
        bool targetIsExisting)
    {
        string connectionString = await _sqlite.CreateDatabaseAsync();
        await using DiscWeaveDbContext context = await CreateInitializedContextAsync(connectionString);
        ImportGraph graph = await AddImportGraphAsync(context, CollectionId.New());
        var targetDraftTrackId = ReleaseImportDraftTrackId.New();
        _ = context.ReleaseImportDraftTracks.Add(
            CreateDraftTrack(graph.CollectionId, graph.DraftId, targetDraftTrackId, "Blue Monday.flac"));
        var sourceExistingTrack = Track.Create(graph.CollectionId, TrackId.New(), "Blue Monday (Radio Edit)");
        var targetExistingTrack = Track.Create(graph.CollectionId, TrackId.New(), "Blue Monday");
        context.Tracks.AddRange(sourceExistingTrack, targetExistingTrack);
        _ = await context.SaveChangesAsync();
        ReleaseImportRelationSuggestionEndpoint source = CreateEndpoint(
            sourceIsExisting,
            graph.DraftTrackId,
            sourceExistingTrack.Id);
        ReleaseImportRelationSuggestionEndpoint target = CreateEndpoint(
            targetIsExisting,
            targetDraftTrackId,
            targetExistingTrack.Id);
        var suggestion = ReleaseImportRelationSuggestion.Create(
            graph.CollectionId,
            graph.SessionId,
            graph.DraftId,
            ReleaseImportRelationSuggestionId.New(),
            "radio-edit",
            82,
            new ReleaseImportRelationSuggestionPayload(source, target, "versionOf"));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);

        _ = await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        ReleaseImportRelationSuggestion saved = await context.ReleaseImportRelationSuggestions
            .AsNoTracking()
            .SingleAsync();
        var typedIds = await context.ReleaseImportRelationSuggestions
            .AsNoTracking()
            .Select(item => new
            {
                SourceTrackId = EF.Property<Guid>(item, "_suggestedSourceTrackId"),
                SourceDraftTrackId = EF.Property<ReleaseImportDraftTrackId?>(item, "_suggestedSourceDraftTrackId"),
                SourceExistingTrackId = EF.Property<TrackId?>(item, "_suggestedSourceExistingTrackId"),
                TargetTrackId = EF.Property<Guid?>(item, "_suggestedTargetTrackId"),
                TargetDraftTrackId = EF.Property<ReleaseImportDraftTrackId?>(item, "_suggestedTargetDraftTrackId"),
                TargetExistingTrackId = EF.Property<TrackId?>(item, "_suggestedTargetExistingTrackId")
            })
            .SingleAsync();

        Assert.Equal(source, saved.SuggestedPayload.Source);
        Assert.Equal(target, saved.SuggestedPayload.Target);
        Assert.Equal(source.TrackId, typedIds.SourceTrackId);
        Assert.Equal(
            sourceIsExisting ? null : new ReleaseImportDraftTrackId(source.TrackId),
            typedIds.SourceDraftTrackId);
        Assert.Equal(
            sourceIsExisting ? new TrackId(source.TrackId) : null,
            typedIds.SourceExistingTrackId);
        Assert.Equal(target.TrackId, typedIds.TargetTrackId);
        Assert.Equal(
            targetIsExisting ? null : new ReleaseImportDraftTrackId(target.TrackId),
            typedIds.TargetDraftTrackId);
        Assert.Equal(
            targetIsExisting ? new TrackId(target.TrackId) : null,
            typedIds.TargetExistingTrackId);
    }

    [Theory(DisplayName = "Release import relation suggestion requires every typed endpoint id to match its endpoint kind")]
    [InlineData(EndpointStorageColumn.SuggestedSource)]
    [InlineData(EndpointStorageColumn.ReviewedSource)]
    [InlineData(EndpointStorageColumn.SuggestedTarget)]
    [InlineData(EndpointStorageColumn.ReviewedTarget)]
    public async Task Release_import_relation_suggestion_requires_every_typed_endpoint_id_to_match_its_endpoint_kind(
        EndpointStorageColumn endpoint)
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
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
                ReleaseImportRelationSuggestionEndpoint.ForDraftTrack(graph.DraftTrackId),
                "versionOf"));
        _ = context.ReleaseImportRelationSuggestions.Add(suggestion);
        _ = await context.SaveChangesAsync();
        string commandText = endpoint switch
        {
            EndpointStorageColumn.SuggestedSource =>
                "UPDATE release_import_relation_suggestions SET suggested_source_draft_track_id = NULL;",
            EndpointStorageColumn.ReviewedSource =>
                "UPDATE release_import_relation_suggestions SET reviewed_source_draft_track_id = NULL;",
            EndpointStorageColumn.SuggestedTarget =>
                "UPDATE release_import_relation_suggestions SET suggested_target_draft_track_id = NULL;",
            EndpointStorageColumn.ReviewedTarget =>
                "UPDATE release_import_relation_suggestions SET reviewed_target_draft_track_id = NULL;",
            _ => throw new ArgumentOutOfRangeException(nameof(endpoint), endpoint, null)
        };

        _ = await Assert.ThrowsAsync<SqliteException>(
            () => context.Database.ExecuteSqlRawAsync(commandText));
    }

}
