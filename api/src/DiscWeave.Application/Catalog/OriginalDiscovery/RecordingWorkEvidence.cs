namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record RecordingWorkEvidence
{
    public required string WorkMbid { get; init; }
    public required bool ExplicitCover { get; init; }
}
