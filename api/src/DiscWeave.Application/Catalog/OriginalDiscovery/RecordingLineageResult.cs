using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public sealed record RecordingLineageResult
{
    public ExternalMetadataSource? SelectedRecording { get; init; }
    public required IReadOnlyList<RecordingLineageCandidate> Candidates { get; init; }
    public required bool ChronologyComplete { get; init; }
    public required IReadOnlyList<string> Warnings { get; init; }
    public IReadOnlyList<ExternalProviderSearchDiagnostic> SearchDiagnostics { get; init; } = [];
}
