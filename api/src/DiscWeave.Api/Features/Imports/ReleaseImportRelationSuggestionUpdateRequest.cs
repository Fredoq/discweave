namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportRelationSuggestionUpdateRequest(
    string Decision,
    ReleaseImportRelationSuggestionPayloadRequest? Reviewed);

public sealed record ReleaseImportRelationSuggestionPayloadRequest(
    ReleaseImportRelationSuggestionEndpointRequest? Source,
    ReleaseImportRelationSuggestionEndpointRequest? Target,
    string? RelationTypeCode);

public sealed record ReleaseImportRelationSuggestionEndpointRequest(
    string Kind,
    Guid Id);
