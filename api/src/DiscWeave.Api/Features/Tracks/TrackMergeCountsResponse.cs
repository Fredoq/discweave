namespace DiscWeave.Api.Features.Tracks;

public sealed record TrackMergeCountsResponse(
    int ReleaseAppearances,
    int LinkedFiles,
    int PlaylistEntries,
    int Credits,
    int Ratings,
    int Relations,
    int ImportReferences);
