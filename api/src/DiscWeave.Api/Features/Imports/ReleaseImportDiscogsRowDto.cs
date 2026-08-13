namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportDiscogsRowDto(
    string ReleaseId,
    int RowOrdinal,
    string Position,
    string Fingerprint);
