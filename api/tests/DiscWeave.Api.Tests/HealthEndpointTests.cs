using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace DiscWeave.Api.Tests;

public sealed class HealthEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public HealthEndpointTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact(DisplayName = "The health endpoint returns the service status")]
    public async Task The_health_endpoint_returns_the_service_status()
    {
        using CancellationTokenSource timeout = new(TimeSpan.FromSeconds(10));
        string dataDirectory = CreateDataDirectory("discweave-health");

        try
        {
            using WebApplicationFactory<Program> factory = _factory.WithWebHostBuilder(builder =>
            {
                _ = builder.UseSetting("ConnectionStrings:DiscWeave", CreateConnectionString(dataDirectory));
                _ = builder.UseSetting("DiscWeave:StorageProvider", "Sqlite");
            });
            HttpClient client = factory.CreateClient();

            using HttpResponseMessage response = await client.GetAsync("/health", timeout.Token);
            using JsonDocument document = await JsonDocument.ParseAsync(
                await response.Content.ReadAsStreamAsync(timeout.Token),
                cancellationToken: timeout.Token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal("discweave", document.RootElement.GetProperty("service").GetString());
            Assert.Equal("ok", document.RootElement.GetProperty("status").GetString());
        }
        finally
        {
            DeleteDirectory(dataDirectory);
        }
    }

    [Fact(DisplayName = "Local desktop mode requires the per launch token")]
    public async Task Local_desktop_mode_requires_the_per_launch_token()
    {
        using CancellationTokenSource timeout = new(TimeSpan.FromSeconds(10));
        const string runtimeModeVariableName = "DISCWEAVE_RUNTIME_MODE";
        string dataDirectory = CreateDataDirectory("discweave-token");
        string? previousRuntimeMode = Environment.GetEnvironmentVariable(runtimeModeVariableName);
        Environment.SetEnvironmentVariable(runtimeModeVariableName, "LocalDesktop");

        try
        {
            using WebApplicationFactory<Program> factory = _factory.WithWebHostBuilder(builder =>
            {
                _ = builder.UseSetting("ConnectionStrings:DiscWeave", CreateConnectionString(dataDirectory));
                _ = builder.UseSetting("DiscWeave:StorageProvider", "Sqlite");
                _ = builder.UseSetting("DiscWeave:LocalDesktop:Token", "test-launch-token");
            });
            HttpClient client = factory.CreateClient();

            using HttpResponseMessage missingTokenResponse = await client.GetAsync("/health", timeout.Token);
            using HttpRequestMessage request = new(HttpMethod.Get, "/health");
            request.Headers.Add("x-discweave-local-token", "test-launch-token");
            using HttpResponseMessage authorizedResponse = await client.SendAsync(request, timeout.Token);

            Assert.Equal(HttpStatusCode.Unauthorized, missingTokenResponse.StatusCode);
            Assert.Equal(HttpStatusCode.OK, authorizedResponse.StatusCode);
        }
        finally
        {
            Environment.SetEnvironmentVariable(runtimeModeVariableName, previousRuntimeMode);
            DeleteDirectory(dataDirectory);
        }
    }

    [Fact(DisplayName = "Local desktop SQLite startup migrates and bootstraps the owner session")]
    public async Task Local_desktop_sqlite_startup_migrates_and_bootstraps_the_owner_session()
    {
        using CancellationTokenSource timeout = new(TimeSpan.FromSeconds(20));
        string dataDirectory = Path.Combine(Path.GetTempPath(), $"discweave-local-{Guid.CreateVersion7():N}");
        const string runtimeModeVariableName = "DISCWEAVE_RUNTIME_MODE";
        const string dataDirectoryVariableName = "DISCWEAVE_DATA_DIR";
        string? previousRuntimeMode = Environment.GetEnvironmentVariable(runtimeModeVariableName);
        string? previousDataDirectory = Environment.GetEnvironmentVariable(dataDirectoryVariableName);
        Environment.SetEnvironmentVariable(runtimeModeVariableName, "LocalDesktop");
        Environment.SetEnvironmentVariable(dataDirectoryVariableName, dataDirectory);

        try
        {
            using WebApplicationFactory<Program> factory = _factory.WithWebHostBuilder(builder =>
            {
                _ = builder.UseSetting("DiscWeave:StorageProvider", "Sqlite");
                _ = builder.UseSetting("DiscWeave:LocalDesktop:Token", "test-launch-token");
            });
            HttpClient client = factory.CreateClient();
            using HttpRequestMessage request = new(HttpMethod.Get, "/api/auth/session");
            request.Headers.Add("x-discweave-local-token", "test-launch-token");

            using HttpResponseMessage response = await client.SendAsync(request, timeout.Token);
            using JsonDocument document = await JsonDocument.ParseAsync(
                await response.Content.ReadAsStreamAsync(timeout.Token),
                cancellationToken: timeout.Token);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.True(document.RootElement.GetProperty("isAuthenticated").GetBoolean());
            Assert.Equal("owner@local.discweave", document.RootElement.GetProperty("email").GetString());
            Assert.Contains(
                document.RootElement.GetProperty("roles").EnumerateArray(),
                role => role.GetString() == "Admin");
        }
        finally
        {
            Environment.SetEnvironmentVariable(runtimeModeVariableName, previousRuntimeMode);
            Environment.SetEnvironmentVariable(dataDirectoryVariableName, previousDataDirectory);
            if (Directory.Exists(dataDirectory))
            {
                Directory.Delete(dataDirectory, recursive: true);
            }
        }
    }

    private static string CreateDataDirectory(string prefix)
    {
        string dataDirectory = Path.Combine(Path.GetTempPath(), $"{prefix}-{Guid.CreateVersion7():N}");
        _ = Directory.CreateDirectory(dataDirectory);

        return dataDirectory;
    }

    private static string CreateConnectionString(string dataDirectory)
    {
        return $"Data Source={Path.Combine(dataDirectory, "discweave.sqlite")}";
    }

    private static void DeleteDirectory(string dataDirectory)
    {
        if (Directory.Exists(dataDirectory))
        {
            Directory.Delete(dataDirectory, recursive: true);
        }
    }
}
