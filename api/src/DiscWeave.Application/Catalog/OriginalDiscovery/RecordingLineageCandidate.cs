using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record RecordingLineageCandidate
{
    public required ExternalMetadataSource RecordingSource { get; init; }
    public required string Title { get; init; }
    public required IReadOnlyList<string> Artists { get; init; }
    public TimeSpan? Duration { get; init; }
    public required IReadOnlyList<RecordingLineageRelation> Relations { get; init; }
    public required IReadOnlyList<RecordingWorkEvidence> WorkEvidence { get; init; }
    public required IReadOnlyList<RecordingReleaseRoute> ReleaseRoutes { get; init; }
    public required bool ChronologyComplete { get; init; }
    public required IReadOnlyList<string> Warnings { get; init; }
}
