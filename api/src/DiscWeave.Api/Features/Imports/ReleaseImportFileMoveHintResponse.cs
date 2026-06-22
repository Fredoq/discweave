namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportFileMoveHintResponse(
    string? PreviousPath,
    string MatchKind,
    string Confidence);
