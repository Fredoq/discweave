namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

internal static class MusicBrainzOptionsValidator
{
    public static bool IsValid(MusicBrainzOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        return Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out Uri? baseUrl) &&
            string.Equals(baseUrl.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
            string.IsNullOrEmpty(baseUrl.UserInfo) &&
            string.IsNullOrEmpty(baseUrl.Query) &&
            string.IsNullOrEmpty(baseUrl.Fragment) &&
            (!options.Enabled ||
                (!string.IsNullOrWhiteSpace(options.ApplicationName) &&
                    !string.IsNullOrWhiteSpace(options.ApplicationVersion) &&
                    !string.IsNullOrWhiteSpace(options.Contact))) &&
            options.TimeoutSeconds is >= 1 and <= 60 &&
            options.OperationTimeoutSeconds is >= 10 and <= 120 &&
            options.MinimumRequestIntervalMilliseconds >= 1000 &&
            options.MaxRetries is >= 0 and <= 3 &&
            options.MaxRetryAfterSeconds is >= 1 and <= 30 &&
            options.MaxRequestsPerOperation is >= 5 and <= 100 &&
            options.MaxRecordingCandidates is >= 1 and <= 10 &&
            options.MaxLineageCandidates is >= 1 and <= 10 &&
            options.MaxReleasePagesPerRecording is >= 1 and <= 20 &&
            options.MaxReleaseGroupLookups is >= 0 and <= 25;
    }
}
