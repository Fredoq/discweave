using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Domain.Tests.Imports;

public sealed class ReleaseImportScanDiagnosticTests
{
    [Fact(DisplayName = "Release import scan diagnostic normalizes text fields")]
    public void Release_import_scan_diagnostic_normalizes_text_fields()
    {
        var diagnostic = ReleaseImportScanDiagnostic.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportScanDiagnosticId.New(),
            " unsupported_extension ",
            ReleaseImportScanDiagnosticSeverity.Info,
            " Import scanner skipped an unsupported file extension. ",
            " /music/Release/notes.txt ",
            " Release/notes.txt ",
            " .TXT ",
            123,
            " scanner ",
            DateTimeOffset.UnixEpoch);

        Assert.Equal("unsupported_extension", diagnostic.Code);
        Assert.Equal(ReleaseImportScanDiagnosticSeverity.Info, diagnostic.Severity);
        Assert.Equal("Import scanner skipped an unsupported file extension.", diagnostic.Message);
        Assert.Equal("/music/Release/notes.txt", diagnostic.FilePath);
        Assert.Equal("Release/notes.txt", diagnostic.RelativePath);
        Assert.Equal(".txt", diagnostic.Extension);
        Assert.Equal(123, diagnostic.SizeBytes);
        Assert.Equal("scanner", diagnostic.Source);
        Assert.Equal(DateTimeOffset.UnixEpoch, diagnostic.CreatedAt);
    }

    [Fact(DisplayName = "Release import scan diagnostic allows missing optional file details")]
    public void Release_import_scan_diagnostic_allows_missing_optional_file_details()
    {
        var diagnostic = ReleaseImportScanDiagnostic.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportScanDiagnosticId.New(),
            "directory_unreadable",
            ReleaseImportScanDiagnosticSeverity.Warning,
            "Import scanner could not read this directory.",
            "/music/Unreadable",
            "Unreadable",
            null,
            null,
            "scanner",
            DateTimeOffset.UnixEpoch);

        Assert.Null(diagnostic.Extension);
        Assert.Null(diagnostic.SizeBytes);
    }

    [Theory(DisplayName = "Release import scan diagnostic validates required text fields")]
    [InlineData("", "message", "/music/file.txt", "file.txt", "scanner", "release_import_scan_diagnostic.code_required")]
    [InlineData("unsupported_extension", "", "/music/file.txt", "file.txt", "scanner", "release_import_scan_diagnostic.message_required")]
    [InlineData("unsupported_extension", "message", "", "file.txt", "scanner", "release_import_scan_diagnostic.file_path_required")]
    [InlineData("unsupported_extension", "message", "/music/file.txt", "", "scanner", "release_import_scan_diagnostic.relative_path_required")]
    [InlineData("unsupported_extension", "message", "/music/file.txt", "file.txt", "", "release_import_scan_diagnostic.source_required")]
    public void Release_import_scan_diagnostic_validates_required_text_fields(
        string code,
        string message,
        string filePath,
        string relativePath,
        string source,
        string expectedCode)
    {
        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportScanDiagnostic.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportScanDiagnosticId.New(),
            code,
            ReleaseImportScanDiagnosticSeverity.Warning,
            message,
            filePath,
            relativePath,
            null,
            null,
            source,
            DateTimeOffset.UnixEpoch));

        Assert.Equal(expectedCode, exception.Code);
    }

    [Fact(DisplayName = "Release import scan diagnostic validates severity")]
    public void Release_import_scan_diagnostic_validates_severity()
    {
        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportScanDiagnostic.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportScanDiagnosticId.New(),
            "unsupported_extension",
            (ReleaseImportScanDiagnosticSeverity)99,
            "Import scanner skipped an unsupported file extension.",
            "/music/Release/notes.txt",
            "Release/notes.txt",
            ".txt",
            null,
            "scanner",
            DateTimeOffset.UnixEpoch));

        Assert.Equal("release_import_scan_diagnostic.severity_invalid", exception.Code);
    }

    [Fact(DisplayName = "Release import scan diagnostic rejects negative sizes")]
    public void Release_import_scan_diagnostic_rejects_negative_sizes()
    {
        DomainException exception = Assert.Throws<DomainException>(() => ReleaseImportScanDiagnostic.Create(
            CollectionId.New(),
            ReleaseImportSessionId.New(),
            ReleaseImportScanDiagnosticId.New(),
            "cover_too_large",
            ReleaseImportScanDiagnosticSeverity.Warning,
            "Import scanner kept the cover path but did not attach an oversized cover artifact.",
            "/music/cover.jpg",
            "cover.jpg",
            ".jpg",
            -1,
            "cover",
            DateTimeOffset.UnixEpoch));

        Assert.Equal("release_import_scan_diagnostic.size_invalid", exception.Code);
    }
}
