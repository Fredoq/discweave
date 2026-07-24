using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Fact(DisplayName = "Discogs provider declares the canonical provider code")]
    public void Discogs_provider_declares_the_canonical_provider_code()
    {
        DiscogsExternalMetadataProvider provider = CreateProvider(JsonHandler("{}"));

        Assert.Equal("discogs", provider.ProviderCode);
    }
}
