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
            UseCookies = false,
            ConnectTimeout = TimeSpan.FromSeconds(10)
        };
    }
}
