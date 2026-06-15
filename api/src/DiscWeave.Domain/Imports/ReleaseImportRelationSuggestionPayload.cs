namespace DiscWeave.Domain.Imports;

public sealed record ReleaseImportRelationSuggestionPayload(
    ReleaseImportRelationSuggestionEndpoint Source,
    ReleaseImportRelationSuggestionEndpoint? Target,
    string? RelationTypeCode);
