using System.Net;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class DiscogsExternalMetadataProviderTests
{
    [Fact]
    public async Task Label_catalog_retries_an_interrupted_response_body_before_succeeding()
    {
        int attempts = 0;
        RecordingHttpMessageHandler handler = new(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = ++attempts == 1
                ? new InterruptedLabelContent()
                : new StringContent(/*lang=json,strict*/ """{"pagination":{"page":1,"pages":1,"items":0,"per_page":100},"releases":[]}""")
        });

        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await CreateProvider(handler)
            .GetLabelReleasesAsync("12", 1, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Items);
        Assert.Equal(2, handler.Requests.Count);
    }

    [Fact]
    public async Task Label_catalog_reports_unavailable_after_bounded_response_body_retries()
    {
        RecordingHttpMessageHandler handler = new(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new InterruptedLabelContent()
        });

        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await CreateProvider(handler)
            .GetLabelReleasesAsync("12", 1, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.Unavailable, result.Error.Kind);
        Assert.Equal(2, handler.Requests.Count);
    }

    [Fact]
    public async Task Label_catalog_rejects_a_stream_exceeding_the_buffer_limit_without_retrying()
    {
        RecordingHttpMessageHandler handler = new(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new OversizedLabelContent()
        });

        ExternalMetadataResult<DiscogsLabelCatalogPage> result = await CreateProvider(handler)
            .GetLabelReleasesAsync("12", 1, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(ExternalMetadataErrorKind.InvalidResponse, result.Error.Kind);
        _ = Assert.Single(handler.Requests);
    }

    private sealed class InterruptedLabelContent : HttpContent
    {
        protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context)
        {
            await stream.WriteAsync("{"u8.ToArray());
            throw new IOException("The response connection was interrupted");
        }

        protected override bool TryComputeLength(out long length)
        {
            length = 0;
            return false;
        }
    }

    private sealed class OversizedLabelContent : HttpContent
    {
        protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context)
        {
            await stream.WriteAsync(new byte[2097153]);
        }

        protected override bool TryComputeLength(out long length)
        {
            length = 0;
            return false;
        }
    }
}
