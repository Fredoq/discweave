namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed class MusicBrainzOptions
{
    public bool Enabled { get; init; }

    public string BaseUrl { get; init; } = "https://musicbrainz.org";

    public string ApplicationName { get; init; } = "DiscWeave";

    public string ApplicationVersion { get; init; } = "";

    public string Contact { get; init; } = "";

    public int TimeoutSeconds { get; init; } = 15;

    public int OperationTimeoutSeconds { get; init; } = 60;

    public int MinimumRequestIntervalMilliseconds { get; init; } = 1000;

    public int MaxRetries { get; init; } = 2;

    public int MaxRetryAfterSeconds { get; init; } = 10;

    public int MaxRequestsPerOperation { get; init; } = 40;

    public int MaxRecordingCandidates { get; init; } = 5;

    public int MaxLineageCandidates { get; init; } = 5;

    public int MaxReleasePagesPerRecording { get; init; } = 5;

    public int MaxReleaseGroupLookups { get; init; } = 10;

    public int MaxWorkRecordingCandidates { get; init; } = 10;

    public int MaxSourceReleaseLookups { get; init; } = 5;

    public int MaxReleaseGroupSearchCandidates { get; init; } = 5;
}
