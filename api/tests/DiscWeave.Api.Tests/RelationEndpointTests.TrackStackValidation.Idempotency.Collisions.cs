using System.Net;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Api.Http;
using Microsoft.AspNetCore.Http;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack relation persistence collisions roll back target promotion")]
    public async Task Stack_relation_persistence_collisions_roll_back_target_promotion()
    {
        var collidingRelationId = Guid.CreateVersion7();
        var failure = new TransactionalFailureTriggerInterceptor("INSERT INTO \"track_relations\"",
            $$"""
            CREATE TRIGGER inject_track_relation_identity_collision
            BEFORE INSERT ON track_relations
            WHEN NEW.track_relation_id <> '{{collidingRelationId:D}}'
            BEGIN
                INSERT INTO track_relations (
                    track_relation_id,
                    collection_id,
                    source_track_id,
                    target_track_id,
                    relation_type,
                    identity_key)
                VALUES (
                    '{{collidingRelationId:D}}',
                    NEW.collection_id,
                    NEW.source_track_id,
                    NEW.target_track_id,
                    NEW.relation_type,
                    NEW.identity_key);
            END;
            """);
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite, services =>
        {
            _ = services.AddDbContext<DiscWeaveDbContext>(options => options.AddInterceptors(failure));
        });
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateTrackAsync(client, "Destination");

        AssertStackError(
            await PostStackRelationAsync(
                client,
                sourceId,
                targetId,
                markTargetAsOriginal: true),
            HttpStatusCode.Conflict,
            "track_relation.duplicate");
        Assert.True(failure.Injected);
        Assert.True(failure.FailureObserved);
        Assert.False(await GetTrackIsOriginalAsync(client, targetId));
        Assert.Equal(0, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation identity collisions map to the duplicate error")]
    public void Stack_relation_identity_collisions_map_to_the_duplicate_error()
    {
        IResult result = TrackRelationsEndpointRouteBuilderExtensions
            .StackRelationIdentityConflict();
        IStatusCodeHttpResult statusResult =
            Assert.IsAssignableFrom<IStatusCodeHttpResult>(result);
        IValueHttpResult valueResult =
            Assert.IsAssignableFrom<IValueHttpResult>(result);
        ErrorResponse error = Assert.IsType<ErrorResponse>(valueResult.Value);

        Assert.Equal(StatusCodes.Status409Conflict, statusResult.StatusCode);
        Assert.Equal("track_relation.duplicate", error.Code);
        Assert.Equal("Track relation already exists", error.Message);
    }
}
