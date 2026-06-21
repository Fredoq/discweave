namespace DiscWeave.Api.Features.Imports;

public sealed record ReleaseImportConfirmationPreflightResponse(
    Guid SessionId,
    Guid DraftId,
    string DraftStatus,
    bool CanConfirm,
    string Outcome,
    ReleaseImportConfirmationSummaryResponse Summary,
    IReadOnlyList<ReleaseImportConfirmationActionResponse> Actions,
    IReadOnlyList<ReleaseImportConfirmationTrackPlanResponse> Tracks,
    IReadOnlyList<ImportIssueResponse> Issues,
    IReadOnlyList<ImportIssueResponse> BlockingErrors);

public sealed record ReleaseImportConfirmationSummaryResponse(
    int IncludedTrackCount,
    int SkippedTrackCount,
    int DuplicateTrackCount,
    int NewReleases,
    int ReusedReleases,
    int UpdatedReleases,
    int NewTracks,
    int ReusedTracks,
    int NewDigitalOwnedItems,
    int ReusedDigitalOwnedItems,
    int NewLocalAudioFiles,
    int UpdatedLocalAudioFiles,
    int NewDigitalTrackFileLinks,
    int RelinkedDigitalTrackFileLinks,
    int UnchangedDigitalTrackFileLinks);

public sealed record ReleaseImportConfirmationActionResponse(
    string Kind,
    string Action,
    int Count,
    string Label);

public sealed record ReleaseImportConfirmationTrackPlanResponse(
    Guid DraftTrackId,
    string Title,
    int? Position,
    bool IsSkipped,
    Guid? SelectedTrackId,
    string TrackAction,
    string LocalFileAction,
    string FileLinkAction);
