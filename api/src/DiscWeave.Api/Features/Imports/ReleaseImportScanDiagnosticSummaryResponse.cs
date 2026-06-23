namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportScanDiagnosticSummaryResponse(
    string Code,
    string Severity,
    int Count);
