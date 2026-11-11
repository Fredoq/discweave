using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class ArchiveCompatibilityTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Web archive status requires authentication and never offers an upgrade")]
    public async Task Web_status_requires_authentication_and_never_offers_upgrade()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient anonymous = host.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/maintenance/schema")).StatusCode);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        using JsonDocument status = await GetJsonAsync(client, "/api/maintenance/schema", HttpStatusCode.OK);
        Assert.Equal("current", status.RootElement.GetProperty("status").GetString());
        Assert.False(status.RootElement.GetProperty("canUpgrade").GetBoolean());
    }

    [Fact(DisplayName = "Declining the known archive upgrade preserves catalog and import access")]
    public async Task Declining_known_upgrade_preserves_catalog_and_import_access()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid session, Guid _) = await host.SeedLabelImportsAsync();
        await host.MakePreviousArchiveSchemaAsync();
        using JsonDocument status = await GetJsonAsync(client, "/api/maintenance/schema", HttpStatusCode.OK);
        Assert.Equal("upgradeRequired", status.RootElement.GetProperty("status").GetString());
        Assert.False(status.RootElement.GetProperty("canUpgrade").GetBoolean());
        foreach (string path in new[] { "/api/labels", "/api/releases", "/api/tracks", "/api/imports", $"/api/imports/{session}" })
        {
            using HttpResponseMessage response = await client.GetAsync(path);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        using JsonDocument links = await GetJsonAsync(client, $"/api/labels/{label}/imports", HttpStatusCode.Conflict);
        Assert.Equal("schema.upgrade_required", links.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsync($"/api/labels/{label}/imports/{session}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/labels/{label}/imports/{session}")).StatusCode);
        await host.AssertArchiveCatalogWasNotChangedAsync();
    }

    [Fact(DisplayName = "An unknown archive fails closed before authentication bootstrap and collection mutations")]
    public async Task Unknown_archive_fails_closed_before_bootstrap_and_mutations()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite);
        using HttpClient client = await host.CreateAuthenticatedClientAsync();
        (Guid label, Guid session, Guid _) = await host.SeedLabelImportsAsync();
        await host.MakeUnknownArchiveSchemaAsync();
        using JsonDocument status = await GetJsonAsync(client, "/api/maintenance/schema", HttpStatusCode.OK);
        Assert.Equal("unsupported", status.RootElement.GetProperty("status").GetString());
        Assert.False(status.RootElement.GetProperty("canUpgrade").GetBoolean());
        using JsonDocument blocked = await GetJsonAsync(client, "/api/labels", HttpStatusCode.Conflict);
        Assert.Equal("schema.unsupported", blocked.RootElement.GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/labels", new { name = "Must not be added" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsync($"/api/labels/{label}/imports/{session}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync("/api/auth/local-bootstrap", null)).StatusCode);
        using HttpClient anonymous = host.CreateClient();
        Assert.Equal(HttpStatusCode.Conflict, (await anonymous.PostAsJsonAsync("/api/auth/register", new { email = "no-write@example.com", password = "Password1!" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync("/health")).StatusCode);
        await host.AssertArchiveCatalogWasNotChangedAsync();
    }

    private static async Task<JsonDocument> GetJsonAsync(HttpClient client, string path, HttpStatusCode expected)
    {
        using HttpResponseMessage response = await client.GetAsync(path);
        Assert.Equal(expected, response.StatusCode);
        return JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    }
}
