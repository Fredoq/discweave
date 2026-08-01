namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

internal static class DiscogsOptionsValidator
{
    public static bool IsValid(DiscogsOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        return
            Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out Uri? baseUrl) &&
            string.Equals(baseUrl.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
            options.TimeoutSeconds is >= 1 and <= 60 &&
            options.MaxOriginalRouteLookups is >= 1 and <= 10 &&
            options.MaxOriginalSearchResultsPerRoute is >= 1 and <= 10 &&
            options.MaxOriginalRequestsPerRoute is >= 1 and <= 50 &&
            options.MaxOriginalRequestsPerDiscovery is >= 1 and <= 100 &&
            options.OriginalDiscoveryTimeoutSeconds is >= 5 and <= 60 &&
            CanParseUserAgent(options.UserAgent);
    }

    public static bool CanParseUserAgent(string? userAgent)
    {
        if (string.IsNullOrWhiteSpace(userAgent))
        {
            return false;
        }

        using var request = new HttpRequestMessage();
        return request.Headers.UserAgent.TryParseAdd(userAgent);
    }
}
