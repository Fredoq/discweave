namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportRelationSuggestionPayloadRequest(
    ReleaseImportRelationSuggestionEndpointRequest? Source,
    ReleaseImportRelationSuggestionEndpointRequest? Target,
    string? RelationTypeCode);
