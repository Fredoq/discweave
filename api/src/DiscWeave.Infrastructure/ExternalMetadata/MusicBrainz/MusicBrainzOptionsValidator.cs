namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

internal static class MusicBrainzOptionsValidator
{
    public static bool IsValid(MusicBrainzOptions options)
    {
        ArgumentNullException.ThrowIfNull(options);

        return Uri.TryCreate(options.BaseUrl, UriKind.Absolute, out Uri? baseUrl) &&
            string.Equals(baseUrl.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(options.ApplicationName) &&
            options.TimeoutSeconds is >= 1 and <= 60 &&
            options.OperationTimeoutSeconds is >= 1 and <= 600 &&
            options.OperationTimeoutSeconds >= options.TimeoutSeconds &&
            options.MinimumRequestIntervalMilliseconds is >= 1 and <= 60_000 &&
            options.MaxRetries is >= 0 and <= 10 &&
            options.MaxRetryAfterSeconds is >= 1 and <= 60 &&
            options.MaxRequestsPerOperation is >= 1 and <= 100 &&
            options.MaxRecordingCandidates is >= 1 and <= 25 &&
            options.MaxLineageCandidates is >= 1 and <= 25 &&
            options.MaxReleasePagesPerRecording is >= 1 and <= 50 &&
            options.MaxReleaseGroupLookups is >= 1 and <= 50;
    }
}
