using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed partial class ReviewWorkbenchEndpointTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ReviewWorkbenchEndpointTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "Review Workbench refresh creates issue state rows from catalog quality signals")]
    public async Task Review_workbench_refresh_creates_issue_state_rows_from_catalog_quality_signals()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateReleaseAsync(client, "Metadata Missing Release");

        using JsonDocument refresh = await SendJsonAsync(
            client.PostAsync("/api/review-workbench/refresh", content: null),
            HttpStatusCode.OK);
        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items?state=open", HttpStatusCode.OK);

        Assert.True(refresh.RootElement.GetProperty("generatedSignals").GetInt32() >= 2);
        Assert.Equal(
            refresh.RootElement.GetProperty("generatedSignals").GetInt32(),
            refresh.RootElement.GetProperty("created").GetInt32());
        Assert.Equal(refresh.RootElement.GetProperty("generatedSignals").GetInt32(), list.RootElement.GetProperty("total").GetInt32());
        Assert.DoesNotContain("collectionId", list.RootElement.GetRawText(), StringComparison.Ordinal);
        Assert.Contains(
            list.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("category").GetString() == "missingMetadata" &&
                item.GetProperty("subtype").GetString() == "releasesMissingYearOrDate" &&
                item.GetProperty("state").GetString() == "open" &&
                item.GetProperty("reason").GetString() == "detected");
    }

    [Fact(DisplayName = "Review Workbench list is read only before refresh")]
    public async Task Review_workbench_list_is_read_only_before_refresh()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateReleaseAsync(client, "Transient Missing Release");

        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items", HttpStatusCode.OK);
        using JsonDocument refresh = await SendJsonAsync(
            client.PostAsync("/api/review-workbench/refresh", content: null),
            HttpStatusCode.OK);

        Assert.True(list.RootElement.GetProperty("total").GetInt32() >= 2);
        Assert.True(refresh.RootElement.GetProperty("created").GetInt32() >= 2);
    }

    [Fact(DisplayName = "Review Workbench patch dismiss resolve and reopen update persisted state")]
    public async Task Review_workbench_patch_dismiss_resolve_and_reopen_update_persisted_state()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        _ = await CreateReleaseAsync(client, "Patchable Missing Release");
        _ = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", content: null), HttpStatusCode.OK);
        string stableKey = await FirstStableKeyAsync(client, "missingMetadata");

        using JsonDocument dismissed = await SendJsonAsync(
            client.PatchAsJsonAsync($"/api/review-workbench/items/{stableKey}/state", new { state = "dismissed", note = "Ignore for now" }),
            HttpStatusCode.OK);
        using JsonDocument active = await GetJsonAsync(client, "/api/review-workbench/items", HttpStatusCode.OK);
        using JsonDocument dismissedList = await GetJsonAsync(client, "/api/review-workbench/items?state=dismissed", HttpStatusCode.OK);
        using JsonDocument resolved = await SendJsonAsync(
            client.PatchAsJsonAsync($"/api/review-workbench/items/{stableKey}/state", new { state = "resolved" }),
            HttpStatusCode.OK);
        using JsonDocument reopened = await SendJsonAsync(
            client.PatchAsJsonAsync($"/api/review-workbench/items/{stableKey}/state", new { state = "reopened" }),
            HttpStatusCode.OK);

        Assert.Equal("dismissed", dismissed.RootElement.GetProperty("state").GetString());
        Assert.Equal("dismissedByUser", dismissed.RootElement.GetProperty("reason").GetString());
        Assert.DoesNotContain(
            active.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("stableKey").GetString() == stableKey);
        Assert.Contains(
            dismissedList.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("stableKey").GetString() == stableKey);
        Assert.Equal("resolved", resolved.RootElement.GetProperty("state").GetString());
        Assert.Equal("resolvedByUser", resolved.RootElement.GetProperty("reason").GetString());
        Assert.Equal("reopened", reopened.RootElement.GetProperty("state").GetString());
        Assert.Equal("reopenedByUser", reopened.RootElement.GetProperty("reason").GetString());
    }

    [Fact(DisplayName = "Review Workbench requires condition and storage only for physical owned items")]
    public async Task Review_workbench_requires_condition_and_storage_only_for_physical_owned_items()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        Guid digitalReleaseId = await CreateReleaseAsync(client, "Digital Workbench Condition Not Required", year: 2001);
        Guid physicalReleaseId = await CreateReleaseAsync(client, "Physical Workbench Condition Required", year: 2002);
        Guid digitalOwnedItemId = await CreateOwnedItemAsync(
            client,
            "release",
            digitalReleaseId,
            "owned",
            new { type = "digital", path = "/music/digital-workbench-condition-not-required.flac", format = "flac" });
        Guid physicalOwnedItemId = await CreateOwnedItemAsync(
            client,
            "release",
            physicalReleaseId,
            "owned",
            new { type = "vinyl", description = "LP" });

        _ = await SendJsonAsync(client.PostAsync("/api/review-workbench/refresh", content: null), HttpStatusCode.OK);
        using JsonDocument list = await GetJsonAsync(client, "/api/review-workbench/items?category=missingMetadata&state=open&limit=50", HttpStatusCode.OK);

        Assert.DoesNotContain(
            list.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("subtype").GetString() == "ownedItemsMissingCondition" &&
                item.GetProperty("targets").EnumerateArray().Any(target => target.GetProperty("id").GetGuid() == digitalOwnedItemId));
        Assert.DoesNotContain(
            list.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("subtype").GetString() == "ownedItemsMissingStorageLocation" &&
                item.GetProperty("targets").EnumerateArray().Any(target => target.GetProperty("id").GetGuid() == digitalOwnedItemId));
        Assert.Contains(
            list.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("subtype").GetString() == "ownedItemsMissingCondition" &&
                item.GetProperty("targets").EnumerateArray().Any(target => target.GetProperty("id").GetGuid() == physicalOwnedItemId));
        Assert.Contains(
            list.RootElement.GetProperty("items").EnumerateArray(),
            item => item.GetProperty("subtype").GetString() == "ownedItemsMissingStorageLocation" &&
                item.GetProperty("targets").EnumerateArray().Any(target => target.GetProperty("id").GetGuid() == physicalOwnedItemId));
    }

    [Fact(DisplayName = "Review Workbench enforces collection isolation")]
    public async Task Review_workbench_enforces_collection_isolation()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        (HttpClient adminClient, HttpClient userClient) = await CreateAuthenticatedClientsAsync(host);
        _ = await CreateReleaseAsync(adminClient, "Admin Only Missing Release");
        _ = await SendJsonAsync(adminClient.PostAsync("/api/review-workbench/refresh", content: null), HttpStatusCode.OK);
        string adminStableKey = await FirstStableKeyAsync(adminClient, "missingMetadata");

        using JsonDocument patch = await SendJsonAsync(
            userClient.PatchAsJsonAsync($"/api/review-workbench/items/{adminStableKey}/state", new { state = "dismissed" }),
            HttpStatusCode.NotFound);
        using JsonDocument userList = await GetJsonAsync(userClient, "/api/review-workbench/items?state=open", HttpStatusCode.OK);

        Assert.Equal("review_workbench.item_not_found", patch.RootElement.GetProperty("code").GetString());
        Assert.DoesNotContain("Admin Only Missing Release", userList.RootElement.GetRawText(), StringComparison.Ordinal);
    }

    [Fact(DisplayName = "Review Workbench rejects invalid filters and unknown keys")]
    public async Task Review_workbench_rejects_invalid_filters_and_unknown_keys()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(_sqlite);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using JsonDocument category = await GetJsonAsync(client, "/api/review-workbench/items?category=bad", HttpStatusCode.BadRequest);
        using JsonDocument state = await GetJsonAsync(client, "/api/review-workbench/items?state=bad", HttpStatusCode.BadRequest);
        using JsonDocument patch = await SendJsonAsync(
            client.PatchAsJsonAsync($"/api/review-workbench/items/{new string('c', 64)}/state", new { state = "dismissed" }),
            HttpStatusCode.NotFound);

        Assert.Equal("review_workbench.category_invalid", category.RootElement.GetProperty("code").GetString());
        Assert.Equal("review_workbench.state_invalid", state.RootElement.GetProperty("code").GetString());
        Assert.Equal("review_workbench.item_not_found", patch.RootElement.GetProperty("code").GetString());
    }

    private static async Task<string> FirstStableKeyAsync(HttpClient client, string category)
    {
        using JsonDocument list = await GetJsonAsync(client, $"/api/review-workbench/items?category={category}&state=open", HttpStatusCode.OK);

        return list.RootElement.GetProperty("items")[0].GetProperty("stableKey").GetString()
            ?? throw new InvalidOperationException("Review Workbench stable key was missing");
    }

    private static async Task<(HttpClient AdminClient, HttpClient UserClient)> CreateAuthenticatedClientsAsync(ApiTestHost host)
    {
        HttpClient adminClient = host.CreateClient();
        using HttpResponseMessage registerResponse = await adminClient.PostAsJsonAsync(
            "/api/auth/register",
            new { email = "owner@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.Created, registerResponse.StatusCode);
        using HttpResponseMessage createUserResponse = await adminClient.PostAsJsonAsync(
            "/api/admin/users",
            new { email = "collector@example.com", password = "Password1!", isAdmin = false });
        Assert.Equal(HttpStatusCode.Created, createUserResponse.StatusCode);
        HttpClient userClient = host.CreateClient();
        using HttpResponseMessage loginResponse = await userClient.PostAsJsonAsync(
            "/api/auth/login",
            new { email = "collector@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

        return (adminClient, userClient);
    }

    private static async Task<Guid> CreateReleaseAsync(HttpClient client, string title, int? year = null)
    {
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/releases",
                new
                {
                    title,
                    type = "standalone",
                    year,
                    isVariousArtists = true,
                    genres = Array.Empty<string>(),
                    tags = Array.Empty<string>()
                }),
            HttpStatusCode.Created);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<Guid> CreateOwnedItemAsync(HttpClient client, string targetType, Guid targetId, string status, object medium)
    {
        using JsonDocument document = await SendJsonAsync(
            client.PostAsJsonAsync(
                "/api/owned-items",
                new
                {
                    targetType,
                    targetId,
                    status,
                    medium
                }),
            HttpStatusCode.Created);

        return document.RootElement.GetProperty("id").GetGuid();
    }

    private static async Task<JsonDocument> GetJsonAsync(HttpClient client, string path, HttpStatusCode expectedStatus)
    {
        using HttpResponseMessage response = await client.GetAsync(path);
        return await ReadExpectedJsonAsync(response, expectedStatus);
    }

    private static async Task<JsonDocument> SendJsonAsync(Task<HttpResponseMessage> request, HttpStatusCode expectedStatus)
    {
        using HttpResponseMessage response = await request;
        return await ReadExpectedJsonAsync(response, expectedStatus);
    }

    private static async Task<JsonDocument> ReadExpectedJsonAsync(HttpResponseMessage response, HttpStatusCode expectedStatus)
    {
        string content = await response.Content.ReadAsStringAsync();
        Assert.Equal(expectedStatus, response.StatusCode);
        return JsonDocument.Parse(content);
    }
}
