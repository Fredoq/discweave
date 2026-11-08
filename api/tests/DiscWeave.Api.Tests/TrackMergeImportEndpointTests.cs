using System.Net;
using System.Net.Http.Json;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed class TrackMergeImportEndpointTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public TrackMergeImportEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact]
    public async Task Track_merge_preserves_confirmed_import_links_and_relation_payloads_after_duplicate_deletion()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        ImportMergeSeed seed = await SeedAsync(host, confirmed: true);
        TrackMergeRequest request = Request(seed);
        using HttpResponseMessage previewResponse = await client.PostAsJsonAsync("/api/tracks/merge/preview", request);
        _ = previewResponse.EnsureSuccessStatusCode();
        TrackMergePreviewResponse preview = (await previewResponse.Content.ReadFromJsonAsync<TrackMergePreviewResponse>())!;
        Assert.True(preview.CanMerge);

        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge",
            request with { PreviewToken = preview.PreviewToken, Confirmed = true });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            Assert.False(await context.Tracks.AnyAsync(track => track.Id == seed.Duplicate));
            ReleaseImportDraftTrack row = await context.ReleaseImportDraftTracks.SingleAsync(track => track.Id == seed.Row);
            Assert.Equal(seed.Keeper, row.SelectedTrackId);
            Assert.Equal("Reviewed import title", row.Title);
            ReleaseImportDraft draft = await context.ReleaseImportDrafts.SingleAsync(item => item.Id == seed.Draft);
            Assert.Equal(ReleaseImportDraftStatus.Confirmed, draft.Status);
            Assert.Equal(seed.Keeper, draft.LocalProvenanceSelection.Match(
                selection => selection.SelectedTrackId.Match(id => id, () => default), () => default));
            Assert.Equal(seed.Revision + 1, draft.ExternalReviewRevision);
            Assert.Equal(seed.Keeper, draft.SelectedOriginalBinding.Match(binding => binding.SourceTrackId, () => default));
            Assert.Equal(new string('a', 64), draft.SelectedOriginalBinding.Match(
                binding => binding.DiscogsRow.Match(locator => locator.Fingerprint, () => string.Empty), () => string.Empty));
            ReleaseImportRelationSuggestion suggestion = await context.ReleaseImportRelationSuggestions.SingleAsync(item => item.Id == seed.Suggestion);
            Assert.Equal(seed.Keeper.Value, suggestion.SuggestedPayload.Target!.TrackId);
            Assert.Equal(seed.Keeper.Value, suggestion.ReviewedPayload.Source.TrackId);
            Assert.Equal(ReleaseImportRelationSuggestionDecision.Accepted, suggestion.Decision);
            ReleaseImportSession session = await context.ReleaseImportSessions.SingleAsync(item => item.Id == seed.Session);
            Assert.Equal(new string('b', 64), session.IdempotencyRequestFingerprint.Match(value => value, () => string.Empty));
            return true;
        });
    }

    [Fact]
    public async Task Track_merge_rejects_active_import_links_without_mutating_catalog_or_review_state()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        ImportMergeSeed seed = await SeedAsync(host, confirmed: false);
        TrackMergeRequest request = Request(seed);
        using HttpResponseMessage previewResponse = await client.PostAsJsonAsync("/api/tracks/merge/preview", request);
        _ = previewResponse.EnsureSuccessStatusCode();
        TrackMergePreviewResponse preview = (await previewResponse.Content.ReadFromJsonAsync<TrackMergePreviewResponse>())!;
        Assert.False(preview.CanMerge);
        Assert.Contains(preview.Conflicts, conflict => conflict.Code == "track.merge_import_review_required");

        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge",
            request with { PreviewToken = preview.PreviewToken, Confirmed = true });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);

        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            Assert.True(await context.Tracks.AnyAsync(track => track.Id == seed.Duplicate));
            ReleaseImportDraftTrack row = await context.ReleaseImportDraftTracks.SingleAsync(track => track.Id == seed.Row);
            Assert.Equal(seed.Duplicate, row.SelectedTrackId);
            ReleaseImportDraft draft = await context.ReleaseImportDrafts.SingleAsync(item => item.Id == seed.Draft);
            Assert.Equal(seed.Revision, draft.ExternalReviewRevision);
            ReleaseImportRelationSuggestion suggestion = await context.ReleaseImportRelationSuggestions.SingleAsync(item => item.Id == seed.Suggestion);
            Assert.Equal(seed.Duplicate.Value, suggestion.SuggestedPayload.Target!.TrackId);
            Assert.Equal(seed.Duplicate.Value, suggestion.ReviewedPayload.Source.TrackId);
            return true;
        });
    }

    [Fact]
    public async Task Track_merge_blocks_import_relations_that_would_collapse_onto_the_kept_track()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        ImportMergeSeed seed = await SeedAsync(host, confirmed: true);
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            ReleaseImportRelationSuggestion suggestion = await context.ReleaseImportRelationSuggestions.SingleAsync(item => item.Id == seed.Suggestion);
            suggestion.Accept(new ReleaseImportRelationSuggestionPayload(
                ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(seed.Duplicate),
                ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(seed.Keeper), "versionOf"));
            return await context.SaveChangesAsync();
        });

        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge/preview", Request(seed));
        _ = response.EnsureSuccessStatusCode();
        TrackMergePreviewResponse preview = (await response.Content.ReadFromJsonAsync<TrackMergePreviewResponse>())!;

        Assert.False(preview.CanMerge);
        Assert.Contains(preview.Conflicts, conflict => conflict.Code == "track.merge_import_relation_conflict");
        Assert.True(await host.WithTrackMergeContextAsync(context => context.Tracks.AnyAsync(track => track.Id == seed.Duplicate)));
    }

    private static TrackMergeRequest Request(ImportMergeSeed seed) => new()
    {
        KeeperTrackId = seed.Keeper.Value,
        DuplicateTrackIds = [seed.Duplicate.Value]
    };

    private static async Task<ImportMergeSeed> SeedAsync(ApiTestHost host, bool confirmed)
    {
        return await host.WithTrackMergeContextAsync(async context =>
        {
            CollectionId collection = host.DefaultCollectionId;
            var keeper = Track.Create(collection, TrackId.New(), "Fire");
            var duplicate = Track.Create(collection, TrackId.New(), "Fire");
            var other = Track.Create(collection, TrackId.New(), "Other recording");
            var release = Release.Create(collection, ReleaseId.New(), "Synthetic release");
            var session = ReleaseImportSession.CreateExternalMetadata(collection, ReleaseImportSessionId.New(),
                "merge-import-test", new string('b', 64), DateTimeOffset.Parse("2026-01-01T00:00:00Z", System.Globalization.CultureInfo.InvariantCulture));
            var fields = new ReleaseImportDraftEditableFields("Synthetic release", "album",
                Optional.Missing<string>(), Optional.Missing<string>(), Optional.Missing<DateOnly>(), Optional.Missing<int>(),
                false, false, Optional.Missing<string>(), [], [], [], [], [], [], true, []);
            var draft = ReleaseImportDraft.CreateExternalMetadata(collection, session.Id, ReleaseImportDraftId.New(), fields,
                ReleaseImportLocalProvenanceSelection.Empty().WithTrack(duplicate.Id));
            var row = ReleaseImportDraftTrack.CreateExternalMetadata(collection, draft.Id, ReleaseImportDraftTrackId.New(),
                new DraftTrackEditableFields(1, null, null, "Reviewed import title", TimeSpan.FromMinutes(3), 1999,
                    [], [], false, [], ReleaseImportTrackMode.Link, duplicate.Id, false, [], true));
            var boundRow = ReleaseImportDraftTrack.CreateExternalMetadata(collection, draft.Id, ReleaseImportDraftTrackId.New(),
                new DraftTrackEditableFields(2, null, null, "Original import row", TimeSpan.FromMinutes(3), 1999,
                    [], [], false, [], ReleaseImportTrackMode.Create, null, false, [], true));
            context.AddRange(keeper, duplicate, other, release, session, draft, row, boundRow);
            _ = await context.SaveChangesAsync();
            draft.InitializeExternalReview(SelectedOriginalBinding.CreateDiscogs(duplicate.Id, boundRow.Id,
                DiscogsReleaseRowLocator.Create("123", 0, "1", new string('a', 64)), false),
                ReleaseImportCollectionItemIntent.NewWanted.WithMedium(ReleaseImportMediumIntent.Digital.Create()), boundRow);
            var suggestion = ReleaseImportRelationSuggestion.Create(collection, session.Id, draft.Id,
                ReleaseImportRelationSuggestionId.New(), "synthetic-version", 100,
                new ReleaseImportRelationSuggestionPayload(ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(other.Id),
                    ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(duplicate.Id), "versionOf"));
            suggestion.Accept(new ReleaseImportRelationSuggestionPayload(ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(duplicate.Id),
                ReleaseImportRelationSuggestionEndpoint.ForExistingTrack(other.Id), "versionOf"));
            if (confirmed)
            {
                draft.Confirm(release.Id);
            }

            _ = context.ReleaseImportRelationSuggestions.Add(suggestion);
            _ = await context.SaveChangesAsync();
            return new ImportMergeSeed(keeper.Id, duplicate.Id, session.Id, draft.Id, row.Id, suggestion.Id, draft.ExternalReviewRevision);
        });
    }

    private sealed record ImportMergeSeed(TrackId Keeper, TrackId Duplicate, ReleaseImportSessionId Session,
        ReleaseImportDraftId Draft, ReleaseImportDraftTrackId Row, ReleaseImportRelationSuggestionId Suggestion, long Revision);
}
