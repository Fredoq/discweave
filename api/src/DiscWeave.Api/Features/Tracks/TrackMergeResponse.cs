namespace DiscWeave.Api.Features.Tracks;

public sealed record TrackMergeResponse(Guid KeeperTrackId, IReadOnlyList<Guid> MergedTrackIds);
