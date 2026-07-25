using DiscWeave.Infrastructure.ExternalMetadata.Caching;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Infrastructure.Tests;

public sealed class MusicBrainzInfrastructureRegistrationTests
{
    [Fact]
    public void Infrastructure_registration_provides_process_wide_request_control_services()
    {
        ServiceCollection services = new();
        IConfiguration configuration = CreateConfiguration();
        _ = services.AddDiscWeaveInfrastructure(configuration);
        using ServiceProvider serviceProvider = services.BuildServiceProvider(validateScopes: true);

        IExternalMetadataRequestCache firstCache = serviceProvider.GetRequiredService<IExternalMetadataRequestCache>();
        IExternalMetadataRequestCache secondCache = serviceProvider.GetRequiredService<IExternalMetadataRequestCache>();
        TimeProvider timeProvider = serviceProvider.GetRequiredService<TimeProvider>();

        Assert.Same(firstCache, secondCache);
        Assert.Same(TimeProvider.System, timeProvider);
    }

    private static IConfiguration CreateConfiguration()
    {
        Dictionary<string, string?> settings = new()
        {
            ["ConnectionStrings:DiscWeave"] = "Data Source=:memory:",
            ["DiscWeave:StorageProvider"] = "Sqlite",
            ["Discogs:UserAgent"] = "DiscWeave.Tests/1.0",
            ["Discogs:BaseUrl"] = "https://api.discogs.test",
            ["Discogs:TimeoutSeconds"] = "10"
        };

        return new ConfigurationBuilder().AddInMemoryCollection(settings).Build();
    }
}
