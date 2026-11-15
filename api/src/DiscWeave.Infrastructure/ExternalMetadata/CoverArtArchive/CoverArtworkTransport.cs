using System.Net;
using System.Net.Sockets;

namespace DiscWeave.Infrastructure.ExternalMetadata.CoverArtArchive;

internal static class CoverArtworkTransport
{
    internal static void ValidateUri(Uri uri)
    {
        string host = uri.IdnHost;
        if (!uri.IsAbsoluteUri || uri.Scheme != Uri.UriSchemeHttps || uri.Port != 443 ||
            !string.IsNullOrEmpty(uri.UserInfo) || !string.IsNullOrEmpty(uri.Fragment) || !IsAllowedHost(host))
        {
            throw CoverArtArchiveProvider.Error("unsafe_redirect", "The artwork provider returned an unsafe address");
        }
    }

    private static bool IsAllowedHost(string host)
    {
        return host.Equals("musicbrainz.org", StringComparison.OrdinalIgnoreCase)
            || host.Equals("coverartarchive.org", StringComparison.OrdinalIgnoreCase)
            || host.Equals("archive.org", StringComparison.OrdinalIgnoreCase)
            || host.EndsWith(".archive.org", StringComparison.OrdinalIgnoreCase);
    }

    internal static SocketsHttpHandler CreateHandler()
    {
        return new SocketsHttpHandler
        {
            AllowAutoRedirect = false,
            UseProxy = false,
            UseCookies = false,
            ConnectTimeout = TimeSpan.FromSeconds(10),
            ConnectCallback = ConnectAsync
        };
    }

    private static async ValueTask<Stream> ConnectAsync(SocketsHttpConnectionContext context, CancellationToken token)
    {
        IPAddress[] resolved = await Dns.GetHostAddressesAsync(context.DnsEndPoint.Host, token).ConfigureAwait(false);
        IPAddress[] addresses = PermittedAddresses(context.DnsEndPoint.Host, resolved);
        // Connect directly to the checked address so DNS cannot change between validation and connection.
        var socket = new Socket(SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
        try
        {
            await socket.ConnectAsync(addresses, context.DnsEndPoint.Port, token).ConfigureAwait(false);
            return new NetworkStream(socket, ownsSocket: true);
        }
        catch
        {
            socket.Dispose();
            throw;
        }
    }

    internal static IPAddress[] PermittedAddresses(string host, IEnumerable<IPAddress> resolved)
    {
        IPAddress[] addresses = [.. resolved.Where(address => IsPermittedDestinationAddress(host, address))];
        return addresses.Length == 0
            ? throw CoverArtArchiveProvider.Error("unsafe_redirect", "The artwork provider resolved to an unsupported network address")
            : addresses;
    }

    internal static bool IsPermittedDestinationAddress(string host, IPAddress address)
    {
        if (!IsAllowedHost(host))
        {
            return false;
        }
        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }
        byte[] bytes = address.GetAddressBytes();
        // VPN fake-IP DNS uses the benchmarking range. Permit it only for the fixed
        // HTTPS provider hosts; SocketsHttpHandler still validates their TLS certificates.
        // Unsupported answers are never passed to the socket, even in a mixed DNS response.
        bool syntheticVpnAddress = bytes.Length == 4 && bytes[0] == 198 && bytes[1] is 18 or 19;
        return IsPublicAddress(address) || syntheticVpnAddress;
    }

    internal static bool IsPublicAddress(IPAddress address)
    {
        if (address.IsIPv4MappedToIPv6)
        {
            return IsPublicAddress(address.MapToIPv4());
        }
        byte[] bytes = address.GetAddressBytes();
        return address.AddressFamily == AddressFamily.InterNetworkV6
            ? IsPublicIpv6(bytes)
            : IsPublicIpv4(bytes);
    }

    private static bool IsPublicIpv6(byte[] bytes)
    {
        // Global unicast only; reject tunnels, special, documentation, local and multicast ranges.
        return (bytes[0] & 0xe0) == 0x20
            && !(bytes[0] == 0x20 && bytes[1] == 0x02)
            && !(bytes[0] == 0x20 && bytes[1] == 0x01 && bytes[2] < 0x02)
            && !(bytes[0] == 0x20 && bytes[1] == 0x01 && bytes[2] == 0x0d && bytes[3] == 0xb8);
    }

    private static bool IsPublicIpv4(byte[] bytes)
    {
        return bytes.Length == 4 && bytes[0] is not (0 or 10 or 127) && bytes[0] < 224
            && !IsLocalIpv4(bytes)
            && !IsReservedIpv4(bytes);
    }

    private static bool IsLocalIpv4(byte[] bytes)
    {
        return (bytes[0] == 169 && bytes[1] == 254)
            || (bytes[0] == 172 && bytes[1] is >= 16 and <= 31)
            || (bytes[0] == 192 && bytes[1] == 168)
            || (bytes[0] == 100 && bytes[1] is >= 64 and <= 127);
    }

    private static bool IsReservedIpv4(byte[] bytes)
    {
        return (bytes[0] == 198 && bytes[1] is 18 or 19)
            || (bytes[0] == 192 && bytes[1] == 0)
            || (bytes[0] == 198 && bytes[1] == 51 && bytes[2] == 100)
            || (bytes[0] == 203 && bytes[1] == 0 && bytes[2] == 113);
    }
}
