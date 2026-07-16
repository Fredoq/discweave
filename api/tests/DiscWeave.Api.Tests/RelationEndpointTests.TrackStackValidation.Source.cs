using System.Net;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
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
}
