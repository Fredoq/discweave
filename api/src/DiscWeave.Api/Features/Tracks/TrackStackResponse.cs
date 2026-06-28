namespace DiscWeave.Api.Features.Tracks;

public sealed record TrackStackResponse(
    Guid OriginalTrackId,
    string OriginalTitle,
    int? OriginalVersionYear,
    int MemberCount,
    bool HasCycleIssue,
    IReadOnlyList<TrackStackMemberResponse> Members,
    IReadOnlyList<TrackStackIssueResponse> Issues);

public sealed record TrackStackMemberResponse(
    Guid TrackId,
    string Title,
    int? VersionYear,
    string RelationType,
    int Depth,
    bool IsDirect);

public sealed record TrackStackIssueResponse(string Code, IReadOnlyList<Guid> TrackIds);
