namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportRelationSuggestionEndpointResponse(
    string Kind,
    Guid Id,
    string? Title = null,
    string? ArtistDisplay = null,
    int? VersionYear = null);
