namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportSessionResponse(
    Guid Id,
    string SourceRoot,
    string Status,
    string ScanMode,
    int DraftCount,
    int TrackCount,
    int IgnoredFileCount,
    int LooseFileCandidateCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    IReadOnlyList<ReleaseImportScanDiagnosticResponse> Diagnostics,
    IReadOnlyList<ReleaseImportScanDiagnosticSummaryResponse> DiagnosticSummaries,
    IReadOnlyList<ReleaseImportLooseFileCandidateResponse>? LooseFileCandidates,
    IReadOnlyList<ReleaseImportDraftResponse>? Drafts,
    IReadOnlyList<ReleaseImportRelationSuggestionResponse>? RelationSuggestions,
    DateTimeOffset? ArchivedAt);
