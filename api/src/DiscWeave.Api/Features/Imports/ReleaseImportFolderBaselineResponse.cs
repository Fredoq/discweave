namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportFolderBaselineResponse(
    string SourceRoot,
    IReadOnlyList<ReleaseImportFolderBaselineDraftResponse> Drafts,
    IReadOnlyList<string> OtherKnownPaths);

public sealed record ReleaseImportFolderBaselineDraftResponse(
    Guid? DraftId,
    string Status,
    string? SourcePath,
    Guid? ReleaseId,
    string Title,
    IReadOnlyList<ReleaseImportFolderBaselineFileResponse> Files);

public sealed record ReleaseImportFolderBaselineFileResponse(
    string Path,
    long? SizeBytes,
    DateTimeOffset? LastModifiedAt,
    Guid? LocalAudioFileId);
