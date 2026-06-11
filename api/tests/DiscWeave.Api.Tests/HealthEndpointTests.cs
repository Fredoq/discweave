using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

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
        const string connectionStringVariableName = "ConnectionStrings__DiscWeave";
        string? previousConnectionString = Environment.GetEnvironmentVariable(connectionStringVariableName);
        Environment.SetEnvironmentVariable(connectionStringVariableName, "Host=localhost;Database=discweave;Username=discweave");

        try
        {
            HttpClient client = _factory.CreateClient();

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
            Environment.SetEnvironmentVariable(connectionStringVariableName, previousConnectionString);
        }
    }

    [Fact(DisplayName = "Local desktop mode requires the per launch token")]
    public async Task Local_desktop_mode_requires_the_per_launch_token()
    {
        using CancellationTokenSource timeout = new(TimeSpan.FromSeconds(10));
        const string runtimeModeVariableName = "DISCWEAVE_RUNTIME_MODE";
        const string connectionStringVariableName = "ConnectionStrings__DiscWeave";
        string? previousRuntimeMode = Environment.GetEnvironmentVariable(runtimeModeVariableName);
        string? previousConnectionString = Environment.GetEnvironmentVariable(connectionStringVariableName);
        Environment.SetEnvironmentVariable(runtimeModeVariableName, "LocalDesktop");
        Environment.SetEnvironmentVariable(connectionStringVariableName, "Host=localhost;Database=discweave;Username=discweave");

        try
        {
            using WebApplicationFactory<Program> factory = _factory.WithWebHostBuilder(builder =>
                builder.ConfigureAppConfiguration((_, configuration) =>
                    configuration.AddInMemoryCollection(new Dictionary<string, string?>
                    {
                        ["DiscWeave:StorageProvider"] = "Postgres",
                        ["DiscWeave:LocalDesktop:Token"] = "test-launch-token"
                    })));
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
            Environment.SetEnvironmentVariable(connectionStringVariableName, previousConnectionString);
        }
    }
}
