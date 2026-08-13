namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record RecordingLineageRelation
{
    public required RecordingLineageRelationKind Kind { get; init; }
    public required RecordingLineageDirection Direction { get; init; }
    public required string SelectedRecordingMbid { get; init; }
    public required string CandidateRecordingMbid { get; init; }
}
