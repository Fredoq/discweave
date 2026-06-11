using System.Net;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;
using Microsoft.Extensions.Options;

namespace DiscWeave.Infrastructure.Tests;

public sealed class DiscogsProviderTokenSwitchTests
{
    [Fact(DisplayName = "Discogs provider treats a saved token as the integration switch")]
    public async Task Discogs_provider_treats_a_saved_token_as_the_integration_switch()
    {
        RecordingHttpMessageHandler handler = new(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                // lang=json
                """
                {
                  "pagination": { "items": 1 },
                  "results": [
                    {
                      "type": "release",
                      "id": 249504,
                      "title": "New Order - Blue Monday",
                      "uri": "/release/249504-New-Order-Blue-Monday"
                    }
                  ]
                }
                """)
        });
        DiscogsExternalMetadataProvider provider = new(
            new HttpClient(handler)
            {
                BaseAddress = new Uri("https://api.discogs.test")
            },
            Options.Create(new DiscogsOptions
            {
                UserAgent = "DiscWeave.Tests/1.0",
                BaseUrl = "https://api.discogs.test",
                TimeoutSeconds = 10
            }),
            new FixedDiscogsAccessTokenProvider("test-token"));

        ExternalMetadataResult<ExternalMetadataSearchResult<ExternalMetadataReleaseCandidate>> result =
            await provider.SearchReleasesAsync(new ExternalMetadataReleaseSearchQuery(Title: "Blue Monday"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        HttpRequestMessage request = Assert.Single(handler.Requests);
        Assert.Equal("Discogs token=test-token", request.Headers.Authorization?.ToString());
    }
}
