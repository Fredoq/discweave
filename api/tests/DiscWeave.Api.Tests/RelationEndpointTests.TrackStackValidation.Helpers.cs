using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class RelationEndpointTests
{
    private static async Task<(HttpStatusCode Status, JsonElement Body)>
        PostStackRelationAsync(
            HttpClient client,
            Guid sourceTrackId,
            Guid targetTrackId,
            string type = "versionOf",
            bool markTargetAsOriginal = false)
    {
        using HttpResponseMessage response = await client.PostAsJsonAsync(
            "/api/track-relations/stack",
            new { sourceTrackId, targetTrackId, type, markTargetAsOriginal });
        using JsonDocument document = await ReadJsonAsync(response);
        return (response.StatusCode, document.RootElement.Clone());
    }

    private static void AssertStackError(
        (HttpStatusCode Status, JsonElement Body) response,
        HttpStatusCode expectedStatus,
        string expectedCode)
    {
        Assert.Equal(expectedStatus, response.Status);
        Assert.Equal(expectedCode, response.Body.GetProperty("code").GetString());
    }

    private static async Task<Guid> CreateOriginalTrackAsync(
        HttpClient client,
        string title)
    {
        Guid trackId = await CreateTrackAsync(client, title);
        await MarkOriginalAsync(client, trackId, title, 2000);
        return trackId;
    }

    private static async Task<bool> GetTrackIsOriginalAsync(
        HttpClient client,
        Guid trackId)
    {
        using HttpResponseMessage response = await client.GetAsync(
            $"/api/tracks/{trackId:D}");
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return document.RootElement.GetProperty("isOriginal").GetBoolean();
    }

    private static async Task<int> GetTrackRelationTotalAsync(HttpClient client)
    {
        using HttpResponseMessage response = await client.GetAsync(
            "/api/track-relations?limit=100&offset=0");
        using JsonDocument document = await ReadJsonAsync(response);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return document.RootElement.GetProperty("total").GetInt32();
    }

    private static async Task SetStackRelationTypesAsync(
        HttpClient client,
        params string[] relationTypeCodes)
    {
        using HttpResponseMessage response = await client.PutAsJsonAsync(
            "/api/settings/track-stack",
            new { defaultRelationTypeCodes = relationTypeCodes });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private static async Task<(HttpClient AdminClient, HttpClient UserClient)>
        CreateStackRelationClientsAsync(ApiTestHost host)
    {
        HttpClient adminClient = host.CreateClient();
        using HttpResponseMessage registerResponse =
            await adminClient.PostAsJsonAsync(
                "/api/auth/register",
                new { email = "owner@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);

        using HttpResponseMessage createUserResponse =
            await adminClient.PostAsJsonAsync(
                "/api/admin/users",
                new
                {
                    email = "collector@example.com",
                    password = "Password1!",
                    isAdmin = false
                });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);

        HttpClient userClient = host.CreateClient();
        using HttpResponseMessage loginResponse =
            await userClient.PostAsJsonAsync(
                "/api/auth/login",
                new { email = "collector@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        return (adminClient, userClient);
    }
}
