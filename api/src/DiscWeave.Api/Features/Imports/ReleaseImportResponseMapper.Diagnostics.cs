using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

internal static partial class ReleaseImportResponseMapper
{
    private static ReleaseImportScanDiagnosticResponse ToScanDiagnosticResponse(ReleaseImportScanDiagnostic diagnostic)
    {
        return new ReleaseImportScanDiagnosticResponse(
            diagnostic.Id.Value,
            diagnostic.Code,
            ScanDiagnosticSeverityCode(diagnostic.Severity),
            diagnostic.Message,
            diagnostic.FilePath,
            diagnostic.RelativePath,
            diagnostic.Extension,
            diagnostic.SizeBytes,
            diagnostic.Source,
            diagnostic.CreatedAt);
    }

    private static IEnumerable<ReleaseImportScanDiagnosticSummaryResponse> ScanDiagnosticSummaries(
        IReadOnlyList<ReleaseImportScanDiagnostic> diagnostics)
    {
        return diagnostics
            .GroupBy(diagnostic => new { diagnostic.Code, diagnostic.Severity })
            .OrderBy(group => group.Key.Severity)
            .ThenBy(group => group.Key.Code, StringComparer.Ordinal)
            .Select(group => new ReleaseImportScanDiagnosticSummaryResponse(
                group.Key.Code,
                ScanDiagnosticSeverityCode(group.Key.Severity),
                group.Count()));
    }

    private static string ScanDiagnosticSeverityCode(ReleaseImportScanDiagnosticSeverity severity)
    {
        return severity switch
        {
            ReleaseImportScanDiagnosticSeverity.Info => "info",
            ReleaseImportScanDiagnosticSeverity.Warning => "warning",
            ReleaseImportScanDiagnosticSeverity.Error => "error",
            _ => throw new InvalidOperationException("Release import scan diagnostic severity is not supported")
        };
    }
}
