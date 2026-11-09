using System.Net;
using System.Net.Http.Json;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Playlists;
using DiscWeave.Domain.Ratings;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackMergeEndpointTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact]
    public async Task Merge_preserves_release_rows_files_playlist_order_credits_ratings_relations_and_metadata()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        Assert.True(preview.CanMerge);
        Assert.Equal(2, preview.Counts.ReleaseAppearances);
        Assert.Equal(1, preview.Counts.LinkedFiles);
        Assert.Equal(2, preview.Counts.PlaylistEntries);
        Assert.Equal(1, preview.Counts.Credits);
        Assert.Equal(1, preview.Counts.Ratings);
        Assert.Equal(2, preview.Counts.Relations);

        using HttpResponseMessage response = await ConfirmAsync(client, seed, preview.PreviewToken);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        await AssertMergedAsync(host, seed);
        using HttpResponseMessage repeated = await ConfirmAsync(client, seed, preview.PreviewToken);
        Assert.Equal(HttpStatusCode.NotFound, repeated.StatusCode);
        await AssertMergedAsync(host, seed);
    }

    [Fact]
    public async Task Preview_is_read_only_and_requires_an_explicit_confirmation_before_deleting_duplicates()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        await AssertUnchangedAsync(host, seed);
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge", new TrackMergeRequest
        {
            KeeperTrackId = seed.Keeper.Value,
            DuplicateTrackIds = [seed.Duplicate.Value],
            PreviewToken = preview.PreviewToken
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertUnchangedAsync(host, seed);
    }

    [Theory]
    [InlineData("title")]
    [InlineData("duration")]
    [InlineData("rating")]
    [InlineData("file")]
    [InlineData("playlist")]
    [InlineData("relation")]
    [InlineData("artist")]
    public async Task Changes_to_reviewed_metadata_or_dependencies_invalidate_the_preview(string change)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            if (change is "title" or "duration")
            {
                Track track = await context.Tracks.SingleAsync(track => track.Id == seed.Duplicate);
                if (change == "title")
                {
                    track.Rename("Changed Fire");
                }
                else
                {
                    track.UpdateDetails(track.Details.WithDuration(TimeSpan.FromSeconds(999)));
                }
            }
            else if (change == "rating")
            {
                RatingValue value = await context.RatingValues.SingleAsync(value => EF.Property<TrackId?>(value, "_targetTrackId") == seed.Duplicate);
                value.UpdateRating(Rating.FromValue(2));
            }
            else if (change == "file")
            {
                LocalAudioFile file = await context.LocalAudioFiles.SingleAsync();
                _ = file.WithContentHash("changed-hash");
            }
            else if (change == "playlist")
            {
                Playlist playlist = await context.Playlists.SingleAsync();
                playlist.ReplaceManualEntries([PlaylistEntry.ForTrack(0, seed.Keeper)]);
            }
            else if (change == "artist")
            {
                Artist artist = await context.Artists.SingleAsync();
                artist.Rename("Changed artist display");
            }
            else
            {
                _ = context.TrackRelations.Add(TrackRelation.Create(TrackRelationId.New(), host.DefaultCollectionId, seed.Other, seed.Keeper, "versionOf"));
            }
            return await context.SaveChangesAsync();
        });
        using HttpResponseMessage response = await ConfirmAsync(client, seed, preview.PreviewToken);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("track_merge.preview_stale", await response.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        Assert.True(await host.WithTrackMergeContextAsync(context => context.Tracks.AnyAsync(track => track.Id == seed.Duplicate)));
    }

    [Fact]
    public async Task Conflicting_rating_values_block_both_preview_confirmation_and_mutation()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            RatingValue value = await context.RatingValues.SingleAsync(value => EF.Property<TrackId?>(value, "_targetTrackId") == seed.Duplicate);
            value.UpdateRating(Rating.FromValue(1));
            return await context.SaveChangesAsync();
        });
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        Assert.False(preview.CanMerge);
        Assert.Contains(preview.Conflicts, conflict => conflict.Code == "track_merge.rating_conflict");
        using HttpResponseMessage response = await ConfirmAsync(client, seed, preview.PreviewToken);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.True(await host.WithTrackMergeContextAsync(context => context.Tracks.AnyAsync(track => track.Id == seed.Duplicate)));
    }

    [Fact]
    public async Task A_failed_duplicate_delete_rolls_back_every_earlier_save_and_search_rebuild()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        await host.ExecuteSqlAsync("CREATE TRIGGER block_track_merge BEFORE DELETE ON tracks BEGIN SELECT RAISE(ABORT, 'Synthetic merge failure'); END;");
        using HttpResponseMessage response = await ConfirmAsync(client, seed, preview.PreviewToken);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertUnchangedAsync(host, seed);
        await host.ExecuteSqlAsync("DROP TRIGGER block_track_merge;");
        TrackMergePreviewResponse after = await PreviewAsync(client, seed);
        using HttpResponseMessage retry = await ConfirmAsync(client, seed, after.PreviewToken);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        await AssertMergedAsync(host, seed);
    }

    private static async Task<TrackMergePreviewResponse> PreviewAsync(HttpClient client, Seed seed)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge/preview", new TrackMergeRequest
        {
            KeeperTrackId = seed.Keeper.Value,
            DuplicateTrackIds = [seed.Duplicate.Value]
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<TrackMergePreviewResponse>() ?? throw new InvalidOperationException("Missing merge preview");
    }

    private static Task<HttpResponseMessage> ConfirmAsync(HttpClient client, Seed seed, string token)
    {
        return client.PostAsJsonAsync("/api/tracks/merge", new TrackMergeRequest
        {
            KeeperTrackId = seed.Keeper.Value,
            DuplicateTrackIds = [seed.Duplicate.Value],
            PreviewToken = token,
            Confirmed = true
        });
    }
}
