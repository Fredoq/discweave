using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Interfaces;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class ReleaseImportSession : IEntity<ReleaseImportSessionId>
{
    private ReleaseImportSession()
    {
        SourceRoot = string.Empty;
    }

    private ReleaseImportSession(
        CollectionId collectionId,
        ReleaseImportSessionId id,
        string sourceRoot,
        ReleaseImportScanMode scanMode,
        DateTimeOffset createdAt)
    {
        CollectionId = collectionId;
        Id = id;
        SourceRoot = Guard.RequiredText(sourceRoot, nameof(sourceRoot), "release_import.source_root_required");
        ScanMode = scanMode;
        Status = ReleaseImportSessionStatus.ReadyForReview;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
    }

    public CollectionId CollectionId { get; private set; }

    public ReleaseImportSessionId Id { get; private set; }

    public string SourceRoot { get; private set; }

    public ReleaseImportScanMode ScanMode { get; private set; }

    public ReleaseImportSessionStatus Status { get; private set; }

    public int DraftCount { get; private set; }

    public int TrackCount { get; private set; }

    public int IgnoredFileCount { get; private set; }

    public int LooseFileCandidateCount { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public DateTimeOffset? ArchivedAt { get; private set; }

    public static ReleaseImportSession Create(
        CollectionId collectionId,
        ReleaseImportSessionId id,
        string sourceRoot,
        DateTimeOffset createdAt,
        ReleaseImportScanMode scanMode = ReleaseImportScanMode.Full)
    {
        return new ReleaseImportSession(collectionId, id, sourceRoot, scanMode, createdAt);
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
