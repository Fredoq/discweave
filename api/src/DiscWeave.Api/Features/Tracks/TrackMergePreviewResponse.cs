namespace DiscWeave.Api.Features.Tracks;

public sealed record TrackMergePreviewResponse(
    string PreviewToken,
    Guid KeeperTrackId,
    IReadOnlyList<Guid> DuplicateTrackIds,
    IReadOnlyList<TrackResponse> Records,
    TrackMergeCountsResponse Counts,
    IReadOnlyList<TrackMergeConflictResponse> Conflicts,
    string MetadataPolicy,
    bool CanMerge);
