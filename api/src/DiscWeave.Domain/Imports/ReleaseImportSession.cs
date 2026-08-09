using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportSession : IEntity<ReleaseImportSessionId>
{
    private ReleaseImportSession()
    {
    }

    private ReleaseImportSession( // NOSONAR: the aggregate constructor restores its complete persisted state.
        CollectionId collectionId,
        ReleaseImportSessionId id,
        ReleaseImportSourceKind sourceKind,
        string? sourceRoot,
        ReleaseImportScanMode? scanMode,
        string? idempotencyKey,
        string? idempotencyRequestFingerprint,
        DateTimeOffset createdAt)
    {
        CollectionId = collectionId;
        Id = id;
        SourceKind = sourceKind;
        _sourceRoot = sourceRoot;
        _scanMode = scanMode;
        _idempotencyKey = idempotencyKey;
        _idempotencyRequestFingerprint = idempotencyRequestFingerprint;
        Status = ReleaseImportSessionStatus.ReadyForReview;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public CollectionId CollectionId { get; private set; }

    public ReleaseImportSessionId Id { get; private set; }

    public ReleaseImportSourceKind SourceKind { get; private set; }

    public IOptionalValue<string> SourceRoot => _sourceRoot is null ? Optional.Missing<string>() : Optional.From(_sourceRoot);

    public IOptionalValue<ReleaseImportScanMode> ScanMode => _scanMode is null
        ? Optional.Missing<ReleaseImportScanMode>()
        : Optional.From(_scanMode.Value);

    public IOptionalValue<string> IdempotencyKey => _idempotencyKey is null
        ? Optional.Missing<string>()
        : Optional.From(_idempotencyKey);

    public IOptionalValue<string> IdempotencyRequestFingerprint => _idempotencyRequestFingerprint is null
        ? Optional.Missing<string>()
        : Optional.From(_idempotencyRequestFingerprint);

    public ReleaseImportSessionStatus Status { get; private set; }

    public int DraftCount { get; private set; }

    public int TrackCount { get; private set; }

    public int IgnoredFileCount { get; private set; }

    public int LooseFileCandidateCount { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public DateTimeOffset? ArchivedAt { get; private set; }

    private readonly string? _sourceRoot;

    private readonly ReleaseImportScanMode? _scanMode;

    private readonly string? _idempotencyKey;

    private readonly string? _idempotencyRequestFingerprint;

    public static ReleaseImportSession Create(
        CollectionId collectionId,
        ReleaseImportSessionId id,
        string sourceRoot,
        DateTimeOffset createdAt,
        ReleaseImportScanMode scanMode = ReleaseImportScanMode.Full)
    {
        return CreateLocalFiles(collectionId, id, sourceRoot, createdAt, scanMode);
    }

    public static ReleaseImportSession CreateLocalFiles(
        CollectionId collectionId,
        ReleaseImportSessionId id,
        string sourceRoot,
        DateTimeOffset createdAt,
        ReleaseImportScanMode scanMode = ReleaseImportScanMode.Full)
    {
        return new ReleaseImportSession(
            collectionId,
            id,
            ReleaseImportSourceKind.LocalFiles,
            Guard.RequiredText(sourceRoot, nameof(sourceRoot), "release_import.source_root_required"),
            scanMode,
            null,
            null,
            createdAt);
    }

    public static ReleaseImportSession CreateExternalMetadata(
        CollectionId collectionId,
        ReleaseImportSessionId id,
        string idempotencyKey,
        string idempotencyRequestFingerprint,
        DateTimeOffset createdAt)
    {
        string normalizedKey = NormalizeIdempotencyKey(idempotencyKey);
        string normalizedFingerprint = NormalizeIdempotencyRequestFingerprint(idempotencyRequestFingerprint);
        return new ReleaseImportSession(
            collectionId,
            id,
            ReleaseImportSourceKind.ExternalMetadata,
            null,
            null,
            normalizedKey,
            normalizedFingerprint,
            createdAt);
    }

    private static string NormalizeIdempotencyKey(string idempotencyKey)
    {
        string normalized = Guard.RequiredText(
            idempotencyKey,
            nameof(idempotencyKey),
            "release_import.idempotency_key_required");
        return normalized.Length <= 128 && normalized.All(character => character is >= '!' and <= '~')
            ? normalized
            : throw new DomainException(
                "release_import.idempotency_key_invalid",
                "External import idempotency key must contain at most 128 visible ASCII characters");
    }

    private static string NormalizeIdempotencyRequestFingerprint(string fingerprint)
    {
        string normalized = Guard.RequiredText(
            fingerprint,
            nameof(fingerprint),
            "release_import.idempotency_fingerprint_required").ToLowerInvariant();
        return normalized.Length == 64 && normalized.All(Uri.IsHexDigit)
            ? normalized
            : throw new DomainException(
                "release_import.idempotency_fingerprint_invalid",
                "External import idempotency fingerprint must be a SHA-256 hexadecimal value");
    }

    public void UpdateCounts(int draftCount, int trackCount, int ignoredFileCount, int looseFileCandidateCount, DateTimeOffset updatedAt)
    {
        if (draftCount < 0 || trackCount < 0 || ignoredFileCount < 0 || looseFileCandidateCount < 0)
        {
            throw new DomainException("release_import.counts_invalid", "Release import session counts cannot be negative");
        }

        DraftCount = draftCount;
        TrackCount = trackCount;
        IgnoredFileCount = ignoredFileCount;
        LooseFileCandidateCount = looseFileCandidateCount;
        UpdatedAt = updatedAt;
    }

    public void Complete(DateTimeOffset updatedAt)
    {
        Status = ReleaseImportSessionStatus.Completed;
        UpdatedAt = updatedAt;
    }

    public void Reopen(DateTimeOffset updatedAt)
    {
        Status = ReleaseImportSessionStatus.ReadyForReview;
        UpdatedAt = updatedAt;
    }

    public void Archive(DateTimeOffset updatedAt)
    {
        ArchivedAt ??= updatedAt;
        UpdatedAt = updatedAt;
    }

    public void Restore(DateTimeOffset updatedAt)
    {
        ArchivedAt = null;
        UpdatedAt = updatedAt;
    }
}
