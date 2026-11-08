namespace DiscWeave.Api.Features.Tracks;

public sealed record TrackMergeRequest
{
    public Guid KeeperTrackId { get; init; }
    public IReadOnlyList<Guid> DuplicateTrackIds { get; init; } = [];
    public string PreviewToken { get; init; } = string.Empty;
    public bool Confirmed { get; init; }
}
