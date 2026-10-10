namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportFolderBaselineFileResponse(
    string Path,
    long? SizeBytes,
    DateTimeOffset? LastModifiedAt,
    Guid? LocalAudioFileId);
