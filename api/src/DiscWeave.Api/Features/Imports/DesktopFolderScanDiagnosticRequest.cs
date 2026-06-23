namespace DiscWeave.Api.Features.Imports;

public sealed record DesktopFolderScanDiagnosticRequest(
    string Code,
    string Severity,
    string Message,
    string FilePath,
    string RelativePath,
    string? Extension,
    long? SizeBytes,
    string Source);
