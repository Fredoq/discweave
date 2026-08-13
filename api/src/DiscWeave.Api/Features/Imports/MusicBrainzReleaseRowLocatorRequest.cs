namespace DiscWeave.Api.Features.Imports;

public sealed record MusicBrainzReleaseRowLocatorRequest
{
    public required Guid ReleaseMbid { get; init; }

    public required string MediumPosition { get; init; }

    public required Guid TrackMbid { get; init; }
}
