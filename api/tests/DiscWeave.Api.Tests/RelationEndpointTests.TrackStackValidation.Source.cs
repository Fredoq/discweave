using System.Net;
using System.Text.Json;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Relations;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack assignment service rejects a self relation")]
    public async Task Stack_assignment_service_rejects_a_self_relation()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track track = AddStackAssignmentTrack(
                context,
                collectionId,
                "Self Service Track");
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                track,
                track,
                "versionOf",
                markTargetAsOriginal: true,
                CancellationToken.None);

            Assert.False(result.IsSuccess);
            Assert.Equal(
                TrackStackAssignmentFailure.SelfRelation,
                result.Failure);
            Assert.False(result.WasCreated);
            Assert.Null(result.Relation);
        }
    }

    [Fact(DisplayName = "Stack assignment service rejects a source that is already a member")]
    public async Task Stack_assignment_service_rejects_a_source_that_is_already_a_member()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Member Service Source");
            Track currentRoot = AddStackAssignmentTrack(
                context,
                collectionId,
                "Member Service Root",
                isOriginal: true);
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Member Service Destination",
                isOriginal: true);
            _ = context.TrackRelations.Add(
                TrackRelation.Create(
                    TrackRelationId.New(),
                    collectionId,
                    source.Id,
                    currentRoot.Id,
                    "versionOf"));
            _ = await context.SaveChangesAsync(
                CancellationToken.None);
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.False(result.IsSuccess);
            Assert.Equal(
                TrackStackAssignmentFailure.SourceNotStandalone,
                result.Failure);
        }
    }

    [Fact(DisplayName = "Stack assignment service rejects a source that already has members")]
    public async Task Stack_assignment_service_rejects_a_source_that_already_has_members()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Root Service Source");
            Track member = AddStackAssignmentTrack(
                context,
                collectionId,
                "Root Service Member");
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Root Service Destination",
                isOriginal: true);
            _ = context.TrackRelations.Add(
                TrackRelation.Create(
                    TrackRelationId.New(),
                    collectionId,
                    member.Id,
                    source.Id,
                    "versionOf"));
            _ = await context.SaveChangesAsync(
                CancellationToken.None);
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.False(result.IsSuccess);
            Assert.Equal(
                TrackStackAssignmentFailure.SourceNotStandalone,
                result.Failure);
        }
    }

    [Fact(DisplayName = "Stack assignment service includes conflicting relations that exist only in the local context")]
    public async Task Stack_assignment_service_includes_conflicting_relations_that_exist_only_in_the_local_context()
    {
        (DiscWeaveDbContext context, CollectionId collectionId) =
            await CreateStackAssignmentContextAsync();
        await using (context)
        {
            Track source = AddStackAssignmentTrack(
                context,
                collectionId,
                "Local Conflict Source");
            Track currentRoot = AddStackAssignmentTrack(
                context,
                collectionId,
                "Local Conflict Root",
                isOriginal: true);
            Track target = AddStackAssignmentTrack(
                context,
                collectionId,
                "Local Conflict Target",
                isOriginal: true);
            _ = context.TrackRelations.Add(
                TrackRelation.Create(
                    TrackRelationId.New(),
                    collectionId,
                    source.Id,
                    currentRoot.Id,
                    "versionOf"));
            TrackStackAssignmentService service =
                CreateStackAssignmentService();

            TrackStackAssignmentResult result = await service.ValidateAsync(
                context,
                collectionId,
                source,
                target,
                "versionOf",
                markTargetAsOriginal: false,
                CancellationToken.None);

            Assert.False(result.IsSuccess);
            Assert.Equal(
                TrackStackAssignmentFailure.SourceNotStandalone,
                result.Failure);
            Assert.Equal(3, context.Tracks.Local.Count);
            _ = Assert.Single(context.TrackRelations.Local);
        }
    }

    [Fact(DisplayName = "Stack relation rejects a source that is already a member")]
    public async Task Stack_relation_rejects_a_source_that_is_already_a_member()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Member Source");
        Guid currentRootId = await CreateOriginalTrackAsync(client, "Current Root");
        Guid destinationId = await CreateOriginalTrackAsync(client, "Destination");
        _ = await CreateTrackRelationAsync(
            client,
            sourceId,
            currentRootId,
            "versionOf");

        AssertStackError(
            await PostStackRelationAsync(client, sourceId, destinationId),
            HttpStatusCode.Conflict,
            "track_relation.stack_source_not_standalone");
    }

    [Fact(DisplayName = "Stack relation rejects a source that already has members")]
    public async Task Stack_relation_rejects_a_source_that_already_has_members()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source Root");
        Guid memberId = await CreateTrackAsync(client, "Existing Member");
        Guid destinationId = await CreateOriginalTrackAsync(client, "Destination");
        _ = await CreateTrackRelationAsync(
            client,
            memberId,
            sourceId,
            "versionOf");

        AssertStackError(
            await PostStackRelationAsync(client, sourceId, destinationId),
            HttpStatusCode.Conflict,
            "track_relation.stack_source_not_standalone");
    }

    [Fact(DisplayName = "Stack relation rejects self targets and cycles")]
    public async Task Stack_relation_rejects_self_targets_and_cycles()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid selfId = await CreateTrackAsync(client, "Self");
        AssertStackError(
            await PostStackRelationAsync(client, selfId, selfId),
            HttpStatusCode.BadRequest,
            "track_relation.stack_self_relation");

        Guid sourceId = await CreateTrackAsync(client, "Cycle Source");
        Guid targetId = await CreateTrackAsync(client, "Cycle Target");
        _ = await CreateTrackRelationAsync(
            client,
            targetId,
            sourceId,
            "versionOf");
        AssertStackError(
            await PostStackRelationAsync(client, sourceId, targetId),
            HttpStatusCode.Conflict,
            "track_relation.stack_cycle");
    }

    [Fact(DisplayName = "Stack relation rejects an identical unknown track id before lookup")]
    public async Task Stack_relation_rejects_an_identical_unknown_track_id_before_lookup()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        var unknownId = Guid.CreateVersion7();

        (HttpStatusCode status, JsonElement body) =
            await PostStackRelationAsync(
                client,
                unknownId,
                unknownId);

        AssertStackError(
            (status, body),
            HttpStatusCode.BadRequest,
            "track_relation.stack_self_relation");
    }

    [Fact(DisplayName = "Stack relation rejects an identical foreign track id before lookup")]
    public async Task Stack_relation_rejects_an_identical_foreign_track_id_before_lookup()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient adminClient, HttpClient userClient) =
            await CreateStackRelationClientsAsync(host);
        Guid foreignId = await CreateTrackAsync(
            userClient,
            "Foreign Self Track");

        (HttpStatusCode status, JsonElement body) =
            await PostStackRelationAsync(
                adminClient,
                foreignId,
                foreignId);

        AssertStackError(
            (status, body),
            HttpStatusCode.BadRequest,
            "track_relation.stack_self_relation");
    }
}
