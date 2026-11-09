using System.Net;
using System.Net.Http.Json;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.Playlists;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackMergeEndpointTests
{
    [Theory]
    [InlineData(-1)]
    [InlineData(0)]
    [InlineData(1)]
    public async Task Merge_retains_the_newest_authoritative_metadata_for_matching_external_source_identities(int duplicateDaysFromKeeper)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        DateTimeOffset keeperAppliedAt = DateTimeOffset.UnixEpoch.AddDays(10);
        DateTimeOffset duplicateAppliedAt = keeperAppliedAt.AddDays(duplicateDaysFromKeeper);
        const string keeperUrl = "https://musicbrainz.org/recording/recording-one?from=keeper";
        const string duplicateUrl = "https://musicbrainz.org/recording/recording-one?from=duplicate";
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            Track keeper = await context.Tracks.SingleAsync(track => track.Id == seed.Keeper);
            Track duplicate = await context.Tracks.SingleAsync(track => track.Id == seed.Duplicate);
            keeper.UnionExternalSources([ExternalSourceReference.Create("musicbrainz", "recording", "recording-one", keeperUrl, keeperAppliedAt)]);
            duplicate.UnionExternalSources([ExternalSourceReference.Create("musicbrainz", "recording", "recording-one", duplicateUrl, duplicateAppliedAt)]);
            return await context.SaveChangesAsync();
        });

        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        using HttpResponseMessage response = await ConfirmAsync(client, seed, preview.PreviewToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            Track keeper = await context.Tracks.SingleAsync(track => track.Id == seed.Keeper);
            Assert.Equal(2, keeper.ExternalSources.Count);
            ExternalSourceReference source = Assert.Single(keeper.ExternalSources, candidate => candidate.ProviderName == "musicbrainz");
            Assert.Equal("recording", source.ResourceType);
            Assert.Equal("recording-one", source.ExternalId);
            Assert.Equal(duplicateDaysFromKeeper >= 0 ? duplicateUrl : keeperUrl, source.SourceUrl);
            Assert.Equal(duplicateDaysFromKeeper >= 0 ? duplicateAppliedAt : keeperAppliedAt, source.AppliedAt);
            Assert.False(await context.Tracks.AnyAsync(track => track.Id == seed.Duplicate));
            return true;
        });
    }

    [Fact]
    public async Task A_merge_removes_all_selected_duplicates_but_leaves_unselected_candidates_and_unique_ratings_intact()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        (TrackId additional, TrackId unselected) = await host.WithTrackMergeContextAsync(async context =>
        {
            var duplicate = Track.Create(host.DefaultCollectionId, TrackId.New(), "Fire");
            var untouched = Track.Create(host.DefaultCollectionId, TrackId.New(), "Fire");
            context.Tracks.AddRange(duplicate, untouched);
            var criterion = RatingCriterion.Create(RatingCriterionId.New(), host.DefaultCollectionId, "unique-merge", "Unique rating", [RatingTargetType.Track], 1000);
            _ = context.RatingCriteria.Add(criterion);
            _ = context.RatingValues.Add(RatingValue.Create(host.DefaultCollectionId, RatingValueId.New(), criterion.Id, RatingTarget.ForTrack(duplicate.Id), Rating.FromValue(3)));
            _ = await context.SaveChangesAsync();
            return (duplicate.Id, untouched.Id);
        });
        var request = new TrackMergeRequest { KeeperTrackId = seed.Keeper.Value, DuplicateTrackIds = [seed.Duplicate.Value, additional.Value] };
        using HttpResponseMessage previewResponse = await client.PostAsJsonAsync("/api/tracks/merge/preview", request);
        TrackMergePreviewResponse preview = (await previewResponse.Content.ReadFromJsonAsync<TrackMergePreviewResponse>())!;
        Assert.True(preview.CanMerge);
        Assert.Equal(3, preview.Records.Count);
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge", request with { PreviewToken = preview.PreviewToken, Confirmed = true });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            Assert.False(await context.Tracks.AnyAsync(track => track.Id == additional || track.Id == seed.Duplicate));
            Assert.True(await context.Tracks.AnyAsync(track => track.Id == unselected));
            RatingValue[] ratings = await context.RatingValues.ToArrayAsync();
            Assert.Equal(2, ratings.Length);
            Assert.All(ratings, rating => Assert.Equal(seed.Keeper, Assert.IsType<TrackRatingTarget>(rating.Target).TrackId));
            Assert.Contains(ratings, rating => rating.Rating.Value == 3);
            return true;
        });
    }

    [Fact]
    public async Task Merge_keeps_the_original_audio_file_bytes_and_path_unchanged()
    {
        string path = Path.GetTempFileName();
        byte[] bytes = [70, 76, 65, 67, 0, 1, 42, 255];
        try
        {
            await File.WriteAllBytesAsync(path, bytes);
            await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
            HttpClient client = await host.CreateAuthenticatedClientAsync();
            Seed seed = await SeedAsync(host);
            _ = await host.WithTrackMergeContextAsync(async context =>
            {
                LocalAudioFile file = await context.LocalAudioFiles.SingleAsync();
                _ = file.MoveTo(FilePath.FromAbsolutePath(path));
                return await context.SaveChangesAsync();
            });
            TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
            using HttpResponseMessage response = await ConfirmAsync(client, seed, preview.PreviewToken);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(bytes, await File.ReadAllBytesAsync(path));
            Assert.Equal(path, await host.WithTrackMergeContextAsync(async context => (await context.LocalAudioFiles.SingleAsync()).Path.Value));
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public async Task Concurrent_confirmation_of_the_same_preview_cannot_apply_a_merge_twice()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        HttpResponseMessage[] responses = await Task.WhenAll(ConfirmAsync(client, seed, preview.PreviewToken), ConfirmAsync(client, seed, preview.PreviewToken));
        try
        {
            Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.OK));
            Assert.Equal(1, responses.Count(response => response.StatusCode == HttpStatusCode.NotFound));
            await AssertMergedAsync(host, seed);
        }
        finally
        {
            foreach (HttpResponseMessage response in responses)
            {
                response.Dispose();
            }
        }
    }

    [Fact]
    public async Task The_preview_returns_current_records_including_metadata_changed_before_the_preview()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            Track keeper = await context.Tracks.SingleAsync(track => track.Id == seed.Keeper);
            keeper.Rename("Current Fire");
            keeper.UpdateDetails(TrackDetails.Empty);
            return await context.SaveChangesAsync();
        });
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        TrackResponse current = Assert.Single(preview.Records, record => record.Id == seed.Keeper.Value);
        Assert.Equal("Current Fire", current.Title);
        Assert.Null(current.DurationSeconds);
        Assert.Equal(241, Assert.Single(preview.Records, record => record.Id == seed.Duplicate.Value).DurationSeconds);
    }

    [Fact]
    public async Task Every_track_foreign_key_references_a_dependency_handled_by_the_merge_safety_model()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        _ = await host.WithTrackMergeContextAsync(context =>
        {
            Type[] actual = [.. context.Model.GetEntityTypes().SelectMany(entity => entity.GetForeignKeys())
                .Where(key => key.PrincipalEntityType.ClrType == typeof(Track)).Select(key => key.DeclaringEntityType.ClrType).Distinct().OrderBy(type => type.FullName)];
            Type[] expected = [typeof(Genre), typeof(Tag), typeof(ExternalSourceReference), typeof(ReleaseTrack), typeof(PlaylistEntry),
                typeof(Credit), typeof(RatingValue), typeof(TrackRelation), typeof(ReleaseImportDraft), typeof(ReleaseImportDraftTrack), typeof(ReleaseImportRelationSuggestion)];
            Assert.All(actual, type => Assert.Contains(type, expected));
            Assert.Contains(typeof(ReleaseTrack), actual);
            return Task.FromResult(true);
        });
    }
}
