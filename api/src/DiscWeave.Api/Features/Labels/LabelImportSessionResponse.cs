namespace DiscWeave.Api.Features.Labels;

public sealed record LabelImportSessionResponse(
    Guid Id,
    string SourceRoot,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? ArchivedAt,
    int PendingDraftCount,
    int ConfirmedDraftCount,
    int SkippedDraftCount,
    int PendingLooseFileCount);
