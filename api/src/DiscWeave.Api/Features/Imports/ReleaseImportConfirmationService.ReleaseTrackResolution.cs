using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static ReleaseTrack ResolveReleaseTrackForDraftTrack(
        Release release,
        Dictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId,
        Dictionary<ReleaseTrackId, ReleaseTrack> releaseTracksByReleaseTrackId,
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        Dictionary<ReleaseImportDraftTrackId, ReleaseTrackId> resolvedReleaseTrackIdsByDraftTrackId,
        ReleaseImportDraftTrack draftTrack)
    {
        return resolvedReleaseTrackIdsByDraftTrackId.TryGetValue(draftTrack.Id, out ReleaseTrackId releaseTrackId)
            ? releaseTracksByReleaseTrackId.TryGetValue(releaseTrackId, out ReleaseTrack? releaseTrack)
                ? releaseTrack
                : throw new DomainException("release_import.release_track_not_resolved", "Release import track was not resolved")
            : draftTrack.TrackMode == ReleaseImportTrackMode.ReleaseOnly
            ? ResolveReleaseOnlyTrackForDraftTrack(release, draftTrack)
            : resolvedTrackIdsByDraftTrackId.TryGetValue(draftTrack.Id, out TrackId trackId)
                ? ResolveCatalogBackedReleaseTrack(releaseTracksByTrackId, trackId, draftTrack)
                : throw new DomainException("release_import.release_track_not_resolved", "Release import track was not resolved");
    }

    private static ReleaseTrack ResolveCatalogBackedReleaseTrack(
        Dictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId,
        TrackId trackId,
        ReleaseImportDraftTrack draftTrack)
    {
        return releaseTracksByTrackId.TryGetValue(trackId, out ReleaseTrack[]? candidates) && candidates.Length > 0
            ? SelectReleaseTrackByPosition(candidates, draftTrack)
                ?? throw new DomainException("release_import.release_track_ambiguous", "Release import track mapping is ambiguous")
            : throw new DomainException("release_import.release_track_not_resolved", "Release import track was not resolved");
    }

    private static ReleaseTrack ResolveReleaseOnlyTrackForDraftTrack(Release release, ReleaseImportDraftTrack draftTrack)
    {
        ReleaseTrack[] candidates = [.. release.Tracklist.Where(track => track.IsReleaseOnly)];

        return SelectReleaseTrackByPosition(candidates, draftTrack)
            ?? throw new DomainException("release_import.release_track_not_resolved", "Release import track was not resolved");
    }

    private static ReleaseTrack? SelectReleaseTrackByPosition(
        ReleaseTrack[] candidates,
        ReleaseImportDraftTrack draftTrack)
    {
        if (draftTrack.Position is { } position)
        {
            ReleaseTrack[] positionMatches = [.. candidates.Where(track => track.Position.Number == position)];
            if (positionMatches.Length == 1)
            {
                return positionMatches[0];
            }
        }

        return candidates.Length == 1 ? candidates[0] : null;
    }
}
