namespace DiscWeave.Api.Features.TrackRelations;

internal sealed class StackTrackRelationRequest
{
    public Guid SourceTrackId { get; init; }
    public Guid TargetTrackId { get; init; }
    public string Type { get; init; } = string.Empty;
    public bool MarkTargetAsOriginal { get; init; }
}
