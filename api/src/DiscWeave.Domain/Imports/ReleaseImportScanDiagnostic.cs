using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportScanDiagnostic : IEntity<ReleaseImportScanDiagnosticId>
{
    private const int CodeMaxLength = 128;
    private const int MessageMaxLength = 1024;
    private const int PathMaxLength = 4096;
    private const int ExtensionMaxLength = 32;
    private const int SourceMaxLength = 64;

    private ReleaseImportScanDiagnostic()
    {
        Code = string.Empty;
        Message = string.Empty;
        FilePath = string.Empty;
        RelativePath = string.Empty;
        Source = string.Empty;
    }

    private ReleaseImportScanDiagnostic(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportScanDiagnosticId id,
        Fields fields,
        DateTimeOffset createdAt)
        : this()
    {
        CollectionId = collectionId;
        SessionId = sessionId;
        Id = id;
        Code = ValidateRequiredText(fields.Code, nameof(fields.Code), CodeMaxLength, "release_import_scan_diagnostic.code_required", "release_import_scan_diagnostic.code_too_long");
        Severity = Guard.DefinedEnum(fields.Severity, nameof(fields.Severity), "release_import_scan_diagnostic.severity_invalid");
        Message = ValidateRequiredText(fields.Message, nameof(fields.Message), MessageMaxLength, "release_import_scan_diagnostic.message_required", "release_import_scan_diagnostic.message_too_long");
        FilePath = ValidateRequiredText(fields.FilePath, nameof(fields.FilePath), PathMaxLength, "release_import_scan_diagnostic.file_path_required", "release_import_scan_diagnostic.file_path_too_long");
        RelativePath = ValidateRequiredText(fields.RelativePath, nameof(fields.RelativePath), PathMaxLength, "release_import_scan_diagnostic.relative_path_required", "release_import_scan_diagnostic.relative_path_too_long");
        Extension = NormalizeExtension(fields.Extension);
        SizeBytes = ValidateSizeBytes(fields.SizeBytes);
        Source = ValidateRequiredText(fields.Source, nameof(fields.Source), SourceMaxLength, "release_import_scan_diagnostic.source_required", "release_import_scan_diagnostic.source_too_long");
        CreatedAt = createdAt;
    }

    public CollectionId CollectionId { get; private set; }

    public ReleaseImportSessionId SessionId { get; private set; }

    public ReleaseImportScanDiagnosticId Id { get; private set; }

    public string Code { get; private set; }

    public ReleaseImportScanDiagnosticSeverity Severity { get; private set; }

    public string Message { get; private set; }

    public string FilePath { get; private set; }

    public string RelativePath { get; private set; }

    public string? Extension { get; private set; }

    public long? SizeBytes { get; private set; }

    public string Source { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public static ReleaseImportScanDiagnostic Create(
        CollectionId collectionId,
        ReleaseImportSessionId sessionId,
        ReleaseImportScanDiagnosticId id,
        Fields fields,
        DateTimeOffset createdAt)
    {
        return new ReleaseImportScanDiagnostic(
            collectionId,
            sessionId,
            id,
            fields,
            createdAt);
    }

    public sealed class Fields
    {
        public required string Code { get; init; }

        public required ReleaseImportScanDiagnosticSeverity Severity { get; init; }

        public required string Message { get; init; }

        public required string FilePath { get; init; }

        public required string RelativePath { get; init; }

        public string? Extension { get; init; }

        public long? SizeBytes { get; init; }

        public required string Source { get; init; }
    }

    private static string ValidateRequiredText(string value, string fieldName, int maxLength, string requiredCode, string tooLongCode)
    {
        string normalized = Guard.RequiredText(value, fieldName, requiredCode);
        return normalized.Length <= maxLength
            ? normalized
            : throw new DomainException(tooLongCode, $"{fieldName} must be at most {maxLength} characters");
    }

    private static string? NormalizeExtension(string? extension)
    {
        if (string.IsNullOrWhiteSpace(extension))
        {
            return null;
        }

        string normalized = extension.Trim().ToLowerInvariant();
        return normalized.Length <= ExtensionMaxLength
            ? normalized
            : throw new DomainException(
                "release_import_scan_diagnostic.extension_too_long",
                $"extension must be at most {ExtensionMaxLength} characters");
    }

    private static long? ValidateSizeBytes(long? sizeBytes)
    {
        return sizeBytes is null
            ? null
            : sizeBytes >= 0
            ? sizeBytes
            : throw new DomainException(
                "release_import_scan_diagnostic.size_invalid",
                "sizeBytes cannot be negative");
    }
}
