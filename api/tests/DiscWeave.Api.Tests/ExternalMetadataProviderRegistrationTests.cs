using System.Net;
using DiscWeave.Application.ExternalMetadata;
using Microsoft.Extensions.DependencyInjection;

namespace DiscWeave.Api.Tests;

public sealed class ExternalMetadataProviderRegistrationTests : IClassFixture<SqliteFixture>
{
    private readonly SqliteFixture _sqlite;

    public ExternalMetadataProviderRegistrationTests(SqliteFixture sqlite)
    {
        _sqlite = sqlite;
    }

    [Fact(DisplayName = "External metadata startup validates duplicate provider declarations")]
    public async Task External_metadata_startup_validates_duplicate_provider_declarations()
    {
        await using ApiTestHost host = await ApiTestHost.CreateAsync(
            _sqlite,
            services => services.AddSingleton<IExternalMetadataProvider>(new FakeExternalMetadataProvider()));

        InvalidOperationException exception = Assert.Throws<InvalidOperationException>(host.CreateClient);

        Assert.Contains("Duplicate external metadata provider code 'discogs'", exception.Message, StringComparison.Ordinal);
    }

    [Fact(DisplayName = "Discogs routes resolve Discogs despite later provider registration")]
    public async Task Discogs_routes_resolve_Discogs_despite_later_provider_registration()
    {
        var discogsProvider = new FakeExternalMetadataProvider
        {
            ReleaseSearchResult = new ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>>(
                new ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>([], 0))
        };
        var laterProvider = new FakeExternalMetadataProvider("musicbrainz");
        await using ApiTestHost host = await ApiTestHost.CreateAsync(
            _sqlite,
            services => FakeExternalMetadataProvider.Register(services, discogsProvider, laterProvider));
        HttpClient client = await host.CreateAuthenticatedClientAsync();

        using HttpResponseMessage response = await client.GetAsync("/api/external-metadata/discogs/releases?q=Factory");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Factory", discogsProvider.LastReleaseSearchQuery?.Query);
        Assert.Null(laterProvider.LastReleaseSearchQuery);
    }
}
