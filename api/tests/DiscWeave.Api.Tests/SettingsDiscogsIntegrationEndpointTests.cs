using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DiscWeave.Api.Tests;

public sealed class SettingsDiscogsIntegrationEndpointTests(SqliteFixture sqlite) : IClassFixture<SqliteFixture>
{
    [Fact(DisplayName = "Discogs integration status is redacted when token is missing")]
    public async Task Discogs_integration_status_is_redacted_when_token_is_missing()
    {
        using var settings = TempIntegrationSettings.Create();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite, settings.Configuration);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync("/api/settings/integrations/discogs");
        string json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("discogs", document.RootElement.GetProperty("providerName").GetString());
        Assert.True(document.RootElement.GetProperty("enabled").GetBoolean());
        Assert.False(document.RootElement.GetProperty("configured").GetBoolean());
        Assert.DoesNotContain("accessToken", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("token", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact(DisplayName = "Discogs token can be saved trimmed and removed without being exposed")]
    public async Task Discogs_token_can_be_saved_trimmed_and_removed_without_being_exposed()
    {
        using var settings = TempIntegrationSettings.Create();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite, settings.Configuration);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage saveResponse = await client.PutAsJsonAsync(
            "/api/settings/integrations/discogs/token",
            new { accessToken = "  local-discogs-token  " });
        string saveJson = await saveResponse.Content.ReadAsStringAsync();
        using var saveDocument = JsonDocument.Parse(saveJson);

        Assert.Equal(HttpStatusCode.OK, saveResponse.StatusCode);
        Assert.True(saveDocument.RootElement.GetProperty("configured").GetBoolean());
        Assert.DoesNotContain("local-discogs-token", saveJson, StringComparison.Ordinal);
        Assert.Contains("local-discogs-token", await File.ReadAllTextAsync(settings.Path), StringComparison.Ordinal);
        Assert.DoesNotContain("  local-discogs-token  ", await File.ReadAllTextAsync(settings.Path), StringComparison.Ordinal);

        using HttpResponseMessage deleteResponse = await client.DeleteAsync("/api/settings/integrations/discogs/token");
        string deleteJson = await deleteResponse.Content.ReadAsStringAsync();
        using var deleteDocument = JsonDocument.Parse(deleteJson);

        Assert.Equal(HttpStatusCode.OK, deleteResponse.StatusCode);
        Assert.False(deleteDocument.RootElement.GetProperty("configured").GetBoolean());
        Assert.DoesNotContain("local-discogs-token", await File.ReadAllTextAsync(settings.Path), StringComparison.Ordinal);
    }

    [Fact(DisplayName = "Bundled Discogs defaults apply a saved local token")]
    public async Task Bundled_Discogs_defaults_apply_a_saved_local_token()
    {
        using var settings = TempIntegrationSettings.Create(useBundledDiscogsDefaults: true);
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite, settings.Configuration);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            "/api/settings/integrations/discogs/token",
            new { accessToken = "desktop-local-token" });
        string json = await response.Content.ReadAsStringAsync();
        using var document = JsonDocument.Parse(json);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(document.RootElement.GetProperty("enabled").GetBoolean());
        Assert.True(document.RootElement.GetProperty("configured").GetBoolean());
        Assert.DoesNotContain("desktop-local-token", json, StringComparison.Ordinal);
    }

    [Theory(DisplayName = "Discogs token rejects invalid values")]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("token\nvalue")]
    public async Task Discogs_token_rejects_invalid_values(string accessToken)
    {
        using var settings = TempIntegrationSettings.Create();
        await using ApiTestHost host = await ApiTestHost.CreateAsync(sqlite, settings.Configuration);
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.PutAsJsonAsync(
            "/api/settings/integrations/discogs/token",
            new { accessToken });
        using JsonDocument document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("settings.integrations.discogs.token_invalid", document.RootElement.GetProperty("code").GetString());
    }

    private sealed class TempIntegrationSettings : IDisposable
    {
        private TempIntegrationSettings(string directory, bool useBundledDiscogsDefaults)
        {
            Directory = directory;
            Path = System.IO.Path.Combine(directory, "integrations.local.json");
            Dictionary<string, string?> configuration = new()
            {
                ["DiscWeave:IntegrationSettingsPath"] = Path
            };
            if (!useBundledDiscogsDefaults)
            {
                configuration["Discogs:Enabled"] = "true";
            }

            Configuration = configuration;
        }

        public string Directory { get; }

        public string Path { get; }

        public IReadOnlyDictionary<string, string?> Configuration { get; }

        public static TempIntegrationSettings Create(bool useBundledDiscogsDefaults = false)
        {
            return new TempIntegrationSettings(
                System.IO.Path.Combine(System.IO.Path.GetTempPath(), $"discweave-integrations-{Guid.CreateVersion7()}"),
                useBundledDiscogsDefaults);
        }

        public void Dispose()
        {
            if (System.IO.Directory.Exists(Directory))
            {
                System.IO.Directory.Delete(Directory, recursive: true);
            }
        }
    }
}
