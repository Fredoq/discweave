using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

namespace DiscWeave.Infrastructure.Tests;

public sealed class CoverArtworkTransportTests
{
    [Theory]
    [InlineData("https://musicbrainz.org/ws/2/release/")]
    [InlineData("https://coverartarchive.org/release/123")]
    [InlineData("https://archive.org/download/artwork")]
    [InlineData("https://ia801234.us.archive.org/download/artwork")]
    [InlineData("https://ia801234.ca.archive.org/download/artwork")]
    public void Official_HTTPS_provider_addresses_are_allowed(string value)
    {
        Assert.Null(Record.Exception(() => CoverArtworkTransport.ValidateUri(new Uri(value))));
    }

    [Theory]
    [InlineData("http://musicbrainz.org/ws/2/release/")]
    [InlineData("https://musicbrainz.org:8443/")]
    [InlineData("https://user@musicbrainz.org/")]
    [InlineData("https://musicbrainz.org/#fragment")]
    [InlineData("https://musicbrainz.org.evil.test/")]
    [InlineData("https://archive.org.evil.test/")]
    [InlineData("https://evil.test/")]
    [InlineData("https://localhost/")]
    [InlineData("https://127.0.0.1/")]
    public void Unsafe_or_unrelated_provider_addresses_are_rejected(string value)
    {
        Assert.Equal("external_cover.unsafe_redirect", Assert.Throws<DomainException>(
            () => CoverArtworkTransport.ValidateUri(new Uri(value))).Code);
    }

    [Fact]
    public void Handler_uses_standard_connections_and_TLS_with_explicit_redirect_control()
    {
        using SocketsHttpHandler handler = CoverArtworkTransport.CreateHandler();
        Assert.Null(handler.ConnectCallback);
        Assert.Null(handler.SslOptions.RemoteCertificateValidationCallback);
        Assert.True(handler.UseProxy);
        Assert.Null(handler.Proxy);
        Assert.False(handler.AllowAutoRedirect);
        Assert.False(handler.UseCookies);
        Assert.Equal(TimeSpan.FromSeconds(10), handler.ConnectTimeout);
    }
}
