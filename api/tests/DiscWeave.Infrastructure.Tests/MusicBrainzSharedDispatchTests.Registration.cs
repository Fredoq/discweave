using DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzSharedDispatchTests
{
    [Fact]
    public void Independent_dependency_scopes_share_one_gate_and_metadata_disables_automatic_redirects()
    {
        var services = new ServiceCollection();
        IConfiguration configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:DiscWeave"] = "Data Source=:memory:",
            ["DiscWeave:StorageProvider"] = "Sqlite",
            ["Discogs:UserAgent"] = "DiscWeave.Tests/1.0",
            ["Discogs:BaseUrl"] = "https://api.discogs.test",
            ["Discogs:TimeoutSeconds"] = "10"
        }).Build();
        _ = services.AddDiscWeaveInfrastructure(configuration);
        using ServiceProvider provider = services.BuildServiceProvider(validateScopes: true);
        using IServiceScope first = provider.CreateScope();
        using IServiceScope second = provider.CreateScope();
        MusicBrainzRequestGate firstGate = first.ServiceProvider.GetRequiredService<MusicBrainzRequestGate>();
        Assert.Same(firstGate, second.ServiceProvider.GetRequiredService<MusicBrainzRequestGate>());
        Assert.Same(firstGate, second.ServiceProvider.GetRequiredService<IMusicBrainzRequestGate>());
        IHttpMessageHandlerFactory factory = provider.GetRequiredService<IHttpMessageHandlerFactory>();
        HttpMessageHandler handler = factory.CreateHandler(nameof(MusicBrainzExternalMetadataProvider));
        while (handler is DelegatingHandler delegating)
        {
            handler = delegating.InnerHandler ?? throw new InvalidOperationException("A delegating handler requires an inner handler");
        }

        HttpClientHandler primary = Assert.IsType<HttpClientHandler>(handler);
        Assert.False(primary.AllowAutoRedirect);
    }
}
