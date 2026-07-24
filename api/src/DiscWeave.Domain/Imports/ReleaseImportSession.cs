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

    private ReleaseImportSession(
        CollectionId collectionId,
        ReleaseImportSessionId id,
        ReleaseImportSourceKind sourceKind,
        string? sourceRoot,
        ReleaseImportScanMode? scanMode,
        DateTimeOffset createdAt)
    {
        CollectionId = collectionId;
        Id = id;
        SourceKind = sourceKind;
        _sourceRoot = sourceRoot;
        _scanMode = scanMode;
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

    public ReleaseImportSessionStatus Status { get; private set; }

    public int DraftCount { get; private set; }

    public int TrackCount { get; private set; }

    public int IgnoredFileCount { get; private set; }

    public int LooseFileCandidateCount { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public DateTimeOffset? ArchivedAt { get; private set; }

#pragma warning disable IDE0044
    private string? _sourceRoot;

    private ReleaseImportScanMode? _scanMode;
#pragma warning restore IDE0044

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
            createdAt);
    }

    public static ReleaseImportSession CreateExternalMetadata(
        CollectionId collectionId,
        ReleaseImportSessionId id,
        DateTimeOffset createdAt)
    {
        return new ReleaseImportSession(
            collectionId,
            id,
            ReleaseImportSourceKind.ExternalMetadata,
            null,
            null,
            createdAt);
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
