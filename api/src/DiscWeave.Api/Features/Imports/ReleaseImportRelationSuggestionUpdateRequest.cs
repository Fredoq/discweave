namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportRelationSuggestionUpdateRequest(
    string Decision,
    ReleaseImportRelationSuggestionPayloadRequest? Reviewed);
