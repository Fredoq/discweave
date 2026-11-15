using System.Net;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

namespace DiscWeave.Infrastructure.Tests;

public sealed class CoverArtworkTransportTests
{
    [Theory]
    [InlineData("musicbrainz.org", "198.18.4.5")]
    [InlineData("coverartarchive.org", "198.19.255.254")]
    [InlineData("archive.org", "::ffff:198.18.4.5")]
    [InlineData("ia801234.us.archive.org", "198.18.0.1")]
    public void Official_providers_support_fake_IP_VPN_addresses_without_classifying_them_as_public(string host, string value)
    {
        var address = IPAddress.Parse(value);
        Assert.False(CoverArtworkTransport.IsPublicAddress(address));
        Assert.True(CoverArtworkTransport.IsPermittedDestinationAddress(host, address));
    }

    [Theory]
    [InlineData("localhost")]
    [InlineData("evil.test")]
    [InlineData("archive.org.evil.test")]
    [InlineData("musicbrainz.org.evil.test")]
    public void Unknown_hosts_cannot_use_public_or_synthetic_addresses(string host)
    {
        Assert.False(CoverArtworkTransport.IsPermittedDestinationAddress(host, IPAddress.Parse("198.18.4.5")));
        Assert.False(CoverArtworkTransport.IsPermittedDestinationAddress(host, IPAddress.Parse("8.8.8.8")));
    }

    [Theory]
    [InlineData("127.0.0.1")]
    [InlineData("10.1.2.3")]
    [InlineData("169.254.169.254")]
    [InlineData("172.20.0.1")]
    [InlineData("192.168.1.1")]
    [InlineData("100.64.0.1")]
    [InlineData("192.0.0.1")]
    [InlineData("198.51.100.1")]
    [InlineData("203.0.113.1")]
    [InlineData("::1")]
    [InlineData("fd00::1")]
    [InlineData("::ffff:127.0.0.1")]
    [InlineData("::ffff:0:c612:405")]
    [InlineData("2001:db8::1")]
    [InlineData("2002:7f00:1::")]
    public void Official_hosts_still_cannot_connect_to_other_nonpublic_addresses(string value)
    {
        Assert.False(CoverArtworkTransport.IsPermittedDestinationAddress("musicbrainz.org", IPAddress.Parse(value)));
    }

    [Fact]
    public void Mixed_DNS_answers_pass_only_individually_permitted_addresses_to_the_connection()
    {
        IPAddress[] resolved = [IPAddress.Parse("198.18.4.5"), IPAddress.Parse("::ffff:0:c612:405"), IPAddress.Loopback];
        IPAddress[] permitted = CoverArtworkTransport.PermittedAddresses("musicbrainz.org", resolved);
        Assert.Equal(IPAddress.Parse("198.18.4.5"), Assert.Single(permitted));
    }

    [Fact]
    public void Empty_or_entirely_disallowed_DNS_answers_fail_before_connecting()
    {
        Assert.Equal("external_cover.unsafe_redirect", Assert.Throws<DomainException>(
            () => CoverArtworkTransport.PermittedAddresses("musicbrainz.org", [])).Code);
        Assert.Equal("external_cover.unsafe_redirect", Assert.Throws<DomainException>(
            () => CoverArtworkTransport.PermittedAddresses("musicbrainz.org", [IPAddress.Loopback])).Code);
    }

    [Fact]
    public void The_handler_preserves_TLS_validation_and_disables_automatic_redirects_and_proxies()
    {
        using SocketsHttpHandler handler = CoverArtworkTransport.CreateHandler();
        Assert.Null(handler.SslOptions.RemoteCertificateValidationCallback);
        Assert.False(handler.AllowAutoRedirect);
        Assert.False(handler.UseProxy);
        Assert.False(handler.UseCookies);
    }
}
