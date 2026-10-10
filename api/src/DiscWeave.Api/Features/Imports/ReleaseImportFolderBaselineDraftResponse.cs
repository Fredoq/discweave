namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportFolderBaselineDraftResponse(
    Guid? DraftId,
    string Status,
    string? SourcePath,
    Guid? ReleaseId,
    string Title,
    IReadOnlyList<ReleaseImportFolderBaselineFileResponse> Files);
