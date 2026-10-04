namespace DiscWeave.Api.Features.TrackRelations;

internal sealed class PromoteStackOriginalRequest
{
    public Guid NewOriginalTrackId { get; init; }
    public Guid CurrentOriginalTrackId { get; init; }
    public string Type { get; init; } = string.Empty;
}
