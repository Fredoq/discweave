namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportMediumIntentDto(
    string Kind,
    string? FormatDescription = null,
    int? DiscCount = null,
    string? TapeType = null,
    string? Name = null);
