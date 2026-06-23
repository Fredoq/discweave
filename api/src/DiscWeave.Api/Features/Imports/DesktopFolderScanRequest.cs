namespace DiscWeave.Api.Features.Imports;

public sealed record DesktopFolderScanRequest(
    string SourceRoot,
    string? ScanMode,
    IReadOnlyList<DesktopFolderScanFileRequest>? Files,
    int IgnoredFileCount,
    IReadOnlyList<DesktopFolderScanDiagnosticRequest>? Diagnostics);
