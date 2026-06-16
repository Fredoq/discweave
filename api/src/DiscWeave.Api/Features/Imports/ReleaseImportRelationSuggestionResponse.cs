namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportRelationSuggestionResponse(
    Guid Id,
    Guid DraftId,
    string Token,
    int Confidence,
    string Decision,
    ReleaseImportRelationSuggestionPayloadResponse Suggested,
    ReleaseImportRelationSuggestionPayloadResponse Reviewed,
    IReadOnlyList<ReleaseImportRelationSuggestionEndpointResponse> TargetOptions,
    bool IsModified);
