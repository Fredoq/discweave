namespace DiscWeave.Api.Features.Imports;

public sealed record ExternalMusicBrainzBindingRebindRequest
{
    public required Guid RecordingMbid { get; init; }

    public required MusicBrainzReleaseRowLocatorRequest MusicBrainzRow { get; init; }

    public required long ExpectedReviewRevision { get; init; }
}
