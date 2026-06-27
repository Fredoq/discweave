namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportLooseFileDraftRequest(
    IReadOnlyList<Guid>? CandidateIds,
    string? ReviewedTitle,
    IReadOnlyList<string>? ReviewedArtistNames);
