using System.Net;
using System.Text.Json;
using DiscWeave.Api.Features.TrackRelations;
using DiscWeave.Api.Http;
using Microsoft.AspNetCore.Http;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    [Fact(DisplayName = "Stack relation retries an identical relation idempotently")]
    public async Task Stack_relation_retries_an_identical_relation_idempotently()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Destination");
        (HttpStatusCode firstStatus, JsonElement firstBody) =
            await PostStackRelationAsync(client, sourceId, targetId);
        (HttpStatusCode retryStatus, JsonElement retryBody) =
            await PostStackRelationAsync(client, sourceId, targetId);
        Assert.Equal(HttpStatusCode.Created, firstStatus);
        Assert.Equal(HttpStatusCode.OK, retryStatus);
        Assert.Equal(
            firstBody.GetProperty("id").GetGuid(),
            retryBody.GetProperty("id").GetGuid());
        Assert.Equal(1, await GetTrackRelationTotalAsync(client));
    }

    [Fact(DisplayName = "Stack relation retry succeeds after its type is removed from stack settings")]
    public async Task Stack_relation_retry_succeeds_after_its_type_is_removed_from_stack_settings()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid sourceId = await CreateTrackAsync(client, "Source");
        Guid targetId = await CreateOriginalTrackAsync(client, "Destination");
        (HttpStatusCode firstStatus, JsonElement firstBody) =
            await PostStackRelationAsync(client, sourceId, targetId);
        await SetStackRelationTypesAsync(client);
        (HttpStatusCode retryStatus, JsonElement retryBody) =
            await PostStackRelationAsync(client, sourceId, targetId);
        Assert.Equal(HttpStatusCode.Created, firstStatus);
        Assert.Equal(HttpStatusCode.OK, retryStatus);
        Assert.Equal(
            firstBody.GetProperty("id").GetGuid(),
            retryBody.GetProperty("id").GetGuid());
        Assert.Equal(1, await GetTrackRelationTotalAsync(client));
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
