namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportRelationSuggestionPayloadResponse(
    ReleaseImportRelationSuggestionEndpointResponse Source,
    ReleaseImportRelationSuggestionEndpointResponse? Target,
    string RelationTypeCode);
