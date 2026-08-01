using System.Net;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Fact(DisplayName = "Discogs HTTP not found maps to the distinct provider state")]
    public async Task Discogs_Http_not_found_maps_to_the_distinct_provider_state()
    {
        DiscogsExternalMetadataProvider provider = CreateProvider(
            new RecordingHttpMessageHandler(_ =>
                new HttpResponseMessage(HttpStatusCode.NotFound)));

        ExternalMetadataResult<ExternalMetadataReleaseDetail> result =
            await provider.GetReleaseAsync(
                new ExternalMetadataLookupQuery("249504"),
                CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.NotFound, result.Error.Kind);
        Assert.Equal("external_metadata.not_found", result.Error.Code);
    }
}
