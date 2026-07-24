using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Infrastructure.Tests;

public sealed class ExternalMetadataProviderResolverTests
{
    [Fact]
    public void Resolve_normalizes_caller_provider_code_and_returns_canonical_provider()
    {
        TestProvider provider = new("discogs");
        var resolver = new ExternalMetadataProviderResolver([provider]);

        ExternalMetadataResult<IExternalMetadataProvider> result = resolver.Resolve(" DISCOGS ");

        Assert.True(result.IsSuccess);
        Assert.Same(provider, result.Value);
        Assert.Equal("discogs", result.Value.ProviderCode);
    }

    [Fact]
    public void Resolve_returns_unknown_provider_for_unregistered_or_invalid_caller_code()
    {
        var resolver = new ExternalMetadataProviderResolver([new TestProvider("discogs")]);

        ExternalMetadataResult<IExternalMetadataProvider> unknown = resolver.Resolve("musicbrainz");
        ExternalMetadataResult<IExternalMetadataProvider> invalid = resolver.Resolve("not a provider");

        Assert.False(unknown.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.UnknownProvider, unknown.Error.Kind);
        Assert.False(invalid.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.UnknownProvider, invalid.Error.Kind);
    }

    [Fact]
    public void Resolve_capability_returns_the_same_provider_instance()
    {
        CapabilityProvider provider = new("discogs");
        var resolver = new ExternalMetadataProviderResolver([provider]);

        ExternalMetadataResult<ITestCapability> result = resolver.ResolveCapability<ITestCapability>("discogs");

        Assert.True(result.IsSuccess);
        Assert.Same(provider, result.Value);
    }

    [Fact]
    public void Resolve_capability_distinguishes_known_provider_without_capability()
    {
        var resolver = new ExternalMetadataProviderResolver([new TestProvider("discogs")]);

        ExternalMetadataResult<ITestCapability> result = resolver.ResolveCapability<ITestCapability>("discogs");

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.UnsupportedCapability, result.Error.Kind);
    }

    [Fact]
    public void Constructor_rejects_duplicate_canonical_provider_codes()
    {
        _ = Assert.Throws<InvalidOperationException>(() =>
        {
            _ = new ExternalMetadataProviderResolver([new TestProvider("discogs"), new TestProvider("discogs")]);
        });
    }

    [Theory]
    [InlineData("")]
    [InlineData(" discogs")]
    [InlineData("discogs ")]
    [InlineData("Discogs")]
    [InlineData("discogs!")]
    public void Constructor_rejects_noncanonical_provider_declarations(string providerCode)
    {
        _ = Assert.Throws<ArgumentException>(() =>
        {
            _ = new ExternalMetadataProviderResolver([new TestProvider(providerCode)]);
        });
    }

    [Fact]
    public void Constructor_rejects_case_variant_declaration_before_duplicate_routing()
    {
        _ = Assert.Throws<ArgumentException>(() =>
        {
            _ = new ExternalMetadataProviderResolver([new TestProvider("discogs"), new TestProvider("DISCOGS")]);
        });
    }

    [Fact]
    public void Provider_codes_are_sorted_ordinally()
    {
        var resolver = new ExternalMetadataProviderResolver(
        [
            new TestProvider("zebra"),
            new TestProvider("discogs"),
            new TestProvider("alpha")
        ]);

        Assert.Equal(["alpha", "discogs", "zebra"], resolver.ProviderCodes);
    }

    [Fact]
    public void Infrastructure_registration_keeps_provider_instances_within_their_own_scope()
    {
        ServiceCollection services = new();
        IConfiguration configuration = CreateInfrastructureConfiguration();
        _ = services.AddSingleton(configuration);
        _ = services.AddDiscWeaveInfrastructure(configuration);
        using ServiceProvider serviceProvider = services.BuildServiceProvider();

        using IServiceScope firstScope = serviceProvider.CreateScope();
        using IServiceScope secondScope = serviceProvider.CreateScope();
        IExternalMetadataProvider first = firstScope.ServiceProvider
            .GetRequiredService<IExternalMetadataProviderResolver>()
            .Resolve("discogs").Value;
        IExternalMetadataProvider second = secondScope.ServiceProvider
            .GetRequiredService<IExternalMetadataProviderResolver>()
            .Resolve("discogs").Value;

        Assert.NotSame(first, second);
    }

    private static IConfiguration CreateInfrastructureConfiguration()
    {
        Dictionary<string, string?> settings = new()
        {
            ["ConnectionStrings:DiscWeave"] = "Data Source=:memory:",
            ["DiscWeave:StorageProvider"] = "Sqlite",
            ["Discogs:UserAgent"] = "DiscWeave.Tests/1.0",
            ["Discogs:BaseUrl"] = "https://api.discogs.test",
            ["Discogs:TimeoutSeconds"] = "10"
        };

        return new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();
    }

    private interface ITestCapability
    {
    }

    private class TestProvider : IExternalMetadataProvider
    {
        public TestProvider(string providerCode)
        {
            ProviderCode = providerCode;
        }

        public string ProviderCode { get; }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>> SearchReleasesAsync(
            ExternalMetadataReleaseSearchQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataReleaseDetail>> GetReleaseAsync(
            ExternalMetadataLookupQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataArtistCandidate>>> SearchArtistsAsync(
            ExternalMetadataArtistSearchQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataArtistDetail>> GetArtistAsync(
            ExternalMetadataLookupQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataTrackCandidate>>> SearchTracksAsync(
            ExternalMetadataTrackSearchQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }

        public Task<ExternalMetadataResult<ExternalMetadataTrackDetail>> GetTrackAsync(
            ExternalMetadataLookupQuery query,
            CancellationToken cancellationToken)
        {
            throw new NotSupportedException();
        }
    }

    private sealed class CapabilityProvider : TestProvider, ITestCapability
    {
        public CapabilityProvider(string providerCode)
            : base(providerCode)
        {
        }
    }

}
