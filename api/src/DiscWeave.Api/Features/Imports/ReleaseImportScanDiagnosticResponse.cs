namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportScanDiagnosticResponse(
    Guid Id,
    string Code,
    string Severity,
    string Message,
    string FilePath,
    string RelativePath,
    string? Extension,
    long? SizeBytes,
    string Source,
    DateTimeOffset CreatedAt);
