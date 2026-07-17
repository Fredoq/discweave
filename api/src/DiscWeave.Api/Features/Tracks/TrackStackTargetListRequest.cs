namespace DiscWeave.Api.Features.Tracks;

public sealed class TrackStackTargetListRequest
{
    public Guid? SourceTrackId { get; init; }
    public string? Search { get; init; }
    public int? Offset { get; init; }
    public int? Limit { get; init; }
}
