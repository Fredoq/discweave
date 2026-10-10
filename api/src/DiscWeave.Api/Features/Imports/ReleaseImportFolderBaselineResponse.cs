namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportFolderBaselineResponse(
    string SourceRoot,
    IReadOnlyList<ReleaseImportFolderBaselineDraftResponse> Drafts,
    IReadOnlyList<string> OtherKnownPaths);
