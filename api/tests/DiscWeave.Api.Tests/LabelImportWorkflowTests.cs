using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class LabelImportWorkflowTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Explicit label links persist without assigning release metadata and can be removed repeatedly")]
    public async Task Explicit_links_can_be_created_and_removed_repeatedly()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid session, Guid _) = await host.SeedLabelImportsAsync();
        string path = $"/api/labels/{label}/imports/{session}";
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync(path, null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync(path, null)).StatusCode);
        using JsonDocument linked = await GetJsonAsync(client, $"/api/labels/{label}/imports");
        Assert.Equal(1, linked.RootElement.GetProperty("total").GetInt32());
        JsonElement item = linked.RootElement.GetProperty("items")[0];
        Assert.Equal(session, item.GetProperty("id").GetGuid());
        Assert.Equal(1, item.GetProperty("pendingDraftCount").GetInt32());
        Assert.Equal(1, item.GetProperty("skippedDraftCount").GetInt32());
        Assert.Equal(0, item.GetProperty("confirmedDraftCount").GetInt32());
        Assert.Equal(1, item.GetProperty("pendingLooseFileCount").GetInt32());
        using JsonDocument releases = await GetJsonAsync(client, "/api/releases");
        Assert.Equal(0, releases.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(path)).StatusCode);
        using JsonDocument unlinked = await GetJsonAsync(client, $"/api/labels/{label}/imports?linked=false");
        Assert.Equal(1, unlinked.RootElement.GetProperty("total").GetInt32());
        using JsonDocument retained = await GetJsonAsync(client, $"/api/imports/{session}");
        Assert.Equal(session, retained.RootElement.GetProperty("id").GetGuid());
    }

    [Fact(DisplayName = "Label import choices exclude external sessions and reject invalid pagination")]
    public async Task Choices_exclude_external_sessions_and_reject_invalid_pagination()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid _, Guid external) = await host.SeedLabelImportsAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsync($"/api/labels/{label}/imports/{external}", null)).StatusCode);
        using JsonDocument page = await GetJsonAsync(client, $"/api/labels/{label}/imports?linked=false&limit=1&offset=1");
        Assert.Equal(1, page.RootElement.GetProperty("total").GetInt32());
        Assert.Empty(page.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/labels/{label}/imports?limit=101")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/labels/{Guid.CreateVersion7()}/imports")).StatusCode);
    }

    [Fact(DisplayName = "Archived linked imports remain visible and deleting an import removes only its links")]
    public async Task Archived_imports_remain_visible_and_deleted_imports_drop_links()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid session, Guid _) = await host.SeedLabelImportsAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/labels/{label}/imports/{session}", null)).StatusCode);
        await host.ArchiveLabelImportSourceAsync(session);
        using JsonDocument page = await GetJsonAsync(client, $"/api/labels/{label}/imports");
        Assert.NotEqual(JsonValueKind.Null, page.RootElement.GetProperty("items")[0].GetProperty("archivedAt").ValueKind);
        await host.DeleteLabelImportSourceAsync(session);
        using JsonDocument empty = await GetJsonAsync(client, $"/api/labels/{label}/imports");
        Assert.Equal(0, empty.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/labels/{label}")).StatusCode);
    }

    [Fact(DisplayName = "Other collections cannot list link or unlink label imports")]
    public async Task Other_collections_cannot_list_link_or_unlink_label_imports()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient owner = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid session, Guid external) = await host.SeedLabelImportsAsync();
        await host.AssertLabelImportForeignKeysAsync(label, session, external);
        using HttpResponseMessage createUser = await owner.PostAsJsonAsync("/api/admin/users", new { email = "other@example.com", password = "Password1!", isAdmin = false });
        Assert.Equal(HttpStatusCode.Created, createUser.StatusCode);
        using HttpClient other = host.CreateClient();
        using HttpResponseMessage login = await other.PostAsJsonAsync("/api/auth/login", new { email = "other@example.com", password = "Password1!" });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"/api/labels/{label}/imports")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsync($"/api/labels/{label}/imports/{session}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync($"/api/labels/{label}/imports/{session}")).StatusCode);
        using HttpResponseMessage createLabel = await other.PostAsJsonAsync("/api/labels", new { name = "Other label" });
        using var created = JsonDocument.Parse(await createLabel.Content.ReadAsStringAsync());
        Guid otherLabel = created.RootElement.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsync($"/api/labels/{otherLabel}/imports/{session}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync($"/api/labels/{otherLabel}/imports/{session}")).StatusCode);
        using JsonDocument choices = await GetJsonAsync(other, $"/api/labels/{otherLabel}/imports?linked=false");
        Assert.Equal(0, choices.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "The append-only upgrade preserves existing imports and supports new links")]
    public async Task The_upgrade_preserves_imports_and_supports_links()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid session, Guid external) = await host.SeedLabelImportsAsync();
        await host.ApplyLabelImportUpgradeToSyntheticDatabaseAsync();
        await host.AssertLabelImportForeignKeysAsync(label, session, external);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/labels/{label}/imports/{session}", null)).StatusCode);
        using JsonDocument links = await GetJsonAsync(client, $"/api/labels/{label}/imports");
        Assert.Equal(1, links.RootElement.GetProperty("total").GetInt32());
    }

    [Fact(DisplayName = "Labels and imports support independent many-to-many links")]
    public async Task Labels_and_imports_support_independent_many_to_many_links()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid session, Guid _) = await host.SeedLabelImportsAsync();
        Guid anotherSession = await host.SeedAnotherLabelImportSessionAsync();
        using HttpResponseMessage create = await client.PostAsJsonAsync("/api/labels", new { name = "Co-label" });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        using var created = JsonDocument.Parse(await create.Content.ReadAsStringAsync());
        Guid anotherLabel = created.RootElement.GetProperty("id").GetGuid();
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/labels/{label}/imports/{session}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/labels/{label}/imports/{anotherSession}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/labels/{anotherLabel}/imports/{session}", null)).StatusCode);
        using JsonDocument both = await GetJsonAsync(client, $"/api/labels/{label}/imports");
        Assert.Equal(2, both.RootElement.GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/labels/{label}/imports/{session}")).StatusCode);
        using JsonDocument first = await GetJsonAsync(client, $"/api/labels/{label}/imports");
        Assert.Equal(anotherSession, Assert.Single(first.RootElement.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
        using JsonDocument second = await GetJsonAsync(client, $"/api/labels/{anotherLabel}/imports");
        Assert.Equal(session, Assert.Single(second.RootElement.GetProperty("items").EnumerateArray()).GetProperty("id").GetGuid());
        using var deleteLabel = new HttpRequestMessage(HttpMethod.Delete, $"/api/labels/{anotherLabel}");
        deleteLabel.Headers.Add("X-DiscWeave-Confirm-Delete", $"label:{anotherLabel}");
        Assert.Equal(HttpStatusCode.NoContent, (await client.SendAsync(deleteLabel)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/imports/{session}")).StatusCode);
    }

    [Fact(DisplayName = "Label import counts track reviewed drafts and consumed loose files without stale session totals")]
    public async Task Counts_track_reviewed_materials_without_stale_session_totals()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid session, Guid _) = await host.SeedLabelImportsAsync();
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsync($"/api/labels/{label}/imports/{session}", null)).StatusCode);
        await host.CompleteLabelImportMaterialsAsync(session);
        using JsonDocument page = await GetJsonAsync(client, $"/api/labels/{label}/imports");
        JsonElement item = Assert.Single(page.RootElement.GetProperty("items").EnumerateArray());
        Assert.Equal(0, item.GetProperty("pendingDraftCount").GetInt32());
        Assert.Equal(1, item.GetProperty("confirmedDraftCount").GetInt32());
        Assert.Equal(1, item.GetProperty("skippedDraftCount").GetInt32());
        Assert.Equal(0, item.GetProperty("pendingLooseFileCount").GetInt32());
    }

    private static async Task<JsonDocument> GetJsonAsync(HttpClient client, string path)
    {
        using HttpResponseMessage response = await client.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }
}
