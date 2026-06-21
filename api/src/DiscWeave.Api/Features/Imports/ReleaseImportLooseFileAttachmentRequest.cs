namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportLooseFileAttachmentRequest(
    Guid ReleaseId,
    IReadOnlyList<ReleaseImportLooseFileAttachmentMappingRequest>? Mappings);

public sealed record ReleaseImportLooseFileAttachmentMappingRequest(
    Guid CandidateId,
    Guid ReleaseTrackId,
    bool ConfirmRelink = false);
