using System.Net;
using System.Net.Http.Json;
using DiscWeave.Api.Features.Tracks;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.Settings;
using DiscWeave.Domain.SharedKernel.Ids;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Tests;

public sealed partial class TrackMergeEndpointTests
{
    [Fact]
    public async Task Foreign_collection_targets_and_tokens_cannot_be_used_to_merge_records()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        TrackId foreignId = await host.WithTrackMergeContextAsync(async context =>
        {
            var foreign = MusicCollection.Create(CollectionId.New(), UserId.New(), "Other collection");
            _ = context.MusicCollections.Add(foreign);
            var track = Track.Create(foreign.Id, TrackId.New(), "Private Fire");
            _ = context.Tracks.Add(track);
            _ = await context.SaveChangesAsync();
            return track.Id;
        });
        foreach (string path in new[] { "/api/tracks/merge/preview", "/api/tracks/merge" })
        {
            using HttpResponseMessage foreign = await client.PostAsJsonAsync(path, new TrackMergeRequest
            {
                KeeperTrackId = seed.Keeper.Value,
                DuplicateTrackIds = [foreignId.Value],
                PreviewToken = "untrusted",
                Confirmed = true
            });
            Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
            Assert.DoesNotContain("Private Fire", await foreign.Content.ReadAsStringAsync(), StringComparison.Ordinal);
        }
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        using HttpResponseMessage modified = await ConfirmAsync(client, seed, preview.PreviewToken + "tampered");
        Assert.Equal(HttpStatusCode.Conflict, modified.StatusCode);
        Assert.True(await host.WithTrackMergeContextAsync(context => context.Tracks.AnyAsync(track => track.Id == foreignId)));
        Assert.True(await host.WithTrackMergeContextAsync(context => context.Tracks.AnyAsync(track => track.Id == seed.Duplicate)));
    }

    [Fact]
    public async Task Preview_tokens_are_bound_to_the_exact_keeper_and_duplicate_subset()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge", new TrackMergeRequest
        {
            KeeperTrackId = seed.Duplicate.Value,
            DuplicateTrackIds = [seed.Keeper.Value],
            PreviewToken = preview.PreviewToken,
            Confirmed = true
        });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertUnchangedAsync(host, seed);
    }

    [Fact]
    public async Task Invalid_duplicate_selections_are_rejected_before_any_writes()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        Guid[][] invalid = [[], [seed.Keeper.Value], [seed.Duplicate.Value, seed.Duplicate.Value], [Guid.Empty]];
        foreach (Guid[] ids in invalid)
        {
            using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge/preview", new TrackMergeRequest
            {
                KeeperTrackId = seed.Keeper.Value,
                DuplicateTrackIds = ids
            });
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        await AssertUnchangedAsync(host, seed);
    }

    [Theory]
    [InlineData("self", "track_merge.self_relation")]
    [InlineData("cycle", "track_merge.stack_cycle")]
    [InlineData("original", "track_merge.original_conflict")]
    [InlineData("roots", "track_merge.different_stacks")]
    public async Task Unsafe_relation_or_stack_changes_block_the_entire_merge(string scenario, string conflictCode)
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Seed seed = await SeedAsync(host);
        _ = await host.WithTrackMergeContextAsync(async context =>
        {
            context.TrackRelations.RemoveRange(context.TrackRelations);
            _ = context.TrackStackSettings.Add(TrackStackSettings.Create(host.DefaultCollectionId, ["versionOf", "remixOf"]));
            if (scenario == "self")
            {
                _ = context.TrackRelations.Add(TrackRelation.Create(TrackRelationId.New(), host.DefaultCollectionId, seed.Duplicate, seed.Keeper, "versionOf"));
            }
            else if (scenario == "cycle")
            {
                context.TrackRelations.AddRange(
                    TrackRelation.Create(TrackRelationId.New(), host.DefaultCollectionId, seed.Keeper, seed.Other, "versionOf"),
                    TrackRelation.Create(TrackRelationId.New(), host.DefaultCollectionId, seed.Other, seed.Duplicate, "versionOf"));
            }
            else if (scenario == "original")
            {
                Track duplicate = await context.Tracks.SingleAsync(track => track.Id == seed.Duplicate);
                duplicate.UpdateMetadata(duplicate.Metadata.WithOriginalMarker(true));
                _ = context.TrackRelations.Add(TrackRelation.Create(TrackRelationId.New(), host.DefaultCollectionId, seed.Other, seed.Duplicate, "versionOf"));
            }
            else
            {
                Track other = await context.Tracks.SingleAsync(track => track.Id == seed.Other);
                other.UpdateMetadata(other.Metadata.WithOriginalMarker(true));
                var root = Track.Create(host.DefaultCollectionId, TrackId.New(), "Second original");
                root.UpdateMetadata(root.Metadata.WithOriginalMarker(true));
                _ = context.Tracks.Add(root);
                context.TrackRelations.AddRange(
                    TrackRelation.Create(TrackRelationId.New(), host.DefaultCollectionId, seed.Keeper, seed.Other, "versionOf"),
                    TrackRelation.Create(TrackRelationId.New(), host.DefaultCollectionId, seed.Duplicate, root.Id, "versionOf"));
            }
            return await context.SaveChangesAsync();
        });
        TrackMergePreviewResponse preview = await PreviewAsync(client, seed);
        Assert.False(preview.CanMerge);
        Assert.Contains(preview.Conflicts, conflict => conflict.Code == conflictCode);
        using HttpResponseMessage response = await ConfirmAsync(client, seed, preview.PreviewToken);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.True(await host.WithTrackMergeContextAsync(context => context.Tracks.AnyAsync(track => track.Id == seed.Duplicate)));
    }

    [Fact]
    public async Task Merge_endpoints_require_an_authenticated_collection_member()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = host.CreateClient();
        using HttpResponseMessage response = await client.PostAsJsonAsync("/api/tracks/merge/preview", new TrackMergeRequest
        {
            KeeperTrackId = Guid.CreateVersion7(),
            DuplicateTrackIds = [Guid.CreateVersion7()]
        });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
