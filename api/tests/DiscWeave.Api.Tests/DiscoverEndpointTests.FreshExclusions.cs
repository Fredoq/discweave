namespace DiscWeave.Api.Tests;

public sealed partial class DiscoverEndpointTests
{
    [Fact(DisplayName = "Discover refreshes title exclusions after a release is added during catalog verification")]
    public async Task Discover_refreshes_title_exclusions_after_a_release_is_added_during_catalog_verification()
    {
        FakeExternalMetadataProvider provider = Provider();
        await using ApiTestHost host = await CreateHostAsync(provider);
        HttpClient client = await host.CreateAuthenticatedClientAsync();
        provider.BeforeReleaseLookupAsync = async cancellationToken =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            _ = await ReleaseAsync(client, "New release", "Artist");
        };

        Assert.Empty((await GenerateAsync(client)).Items);
        Assert.Equal(1, provider.ReleaseLookupCallCount);
    }
}
