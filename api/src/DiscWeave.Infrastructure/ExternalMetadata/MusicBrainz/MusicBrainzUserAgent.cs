namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

internal static class MusicBrainzUserAgent
{
    public static string Build(MusicBrainzOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);
        return $"{options.ApplicationName}/{options.ApplicationVersion} ({options.Contact})";
    }

    public static bool IsValid(MusicBrainzOptions options)
    {
        using var request = new HttpRequestMessage();
        return request.Headers.UserAgent.TryParseAdd(Build(options));
    }
}
