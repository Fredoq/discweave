using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private const string ReleaseTrackNotResolvedCode = "release_import.release_track_not_resolved";
    private const string ReleaseTrackNotResolvedMessage = "Release import track was not resolved";

    private static ReleaseTrack ResolveReleaseTrackForDraftTrack(
        Release release,
        Dictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId,
        Dictionary<ReleaseTrackId, ReleaseTrack> releaseTracksByReleaseTrackId,
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        Dictionary<ReleaseImportDraftTrackId, ReleaseTrackId> resolvedReleaseTrackIdsByDraftTrackId,
        ReleaseImportDraftTrack draftTrack)
    {
        return resolvedReleaseTrackIdsByDraftTrackId.TryGetValue(draftTrack.Id, out ReleaseTrackId releaseTrackId)
            ? ResolvePreviouslyResolvedReleaseTrack(releaseTracksByReleaseTrackId, releaseTrackId)
            : ResolveReleaseTrackByMode(
                release,
                releaseTracksByTrackId,
                resolvedTrackIdsByDraftTrackId,
                draftTrack);
    }

    private static ReleaseTrack ResolvePreviouslyResolvedReleaseTrack(
        Dictionary<ReleaseTrackId, ReleaseTrack> releaseTracksByReleaseTrackId,
        ReleaseTrackId releaseTrackId)
    {
        return releaseTracksByReleaseTrackId.TryGetValue(releaseTrackId, out ReleaseTrack? releaseTrack)
            ? releaseTrack
            : throw ReleaseTrackNotResolved();
    }

    private static ReleaseTrack ResolveReleaseTrackByMode(
        Release release,
        Dictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId,
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        ReleaseImportDraftTrack draftTrack)
    {
        return draftTrack.TrackMode switch
        {
            ReleaseImportTrackMode.Create => ResolveResolvedCatalogTrack(
                releaseTracksByTrackId,
                resolvedTrackIdsByDraftTrackId,
                draftTrack),
            ReleaseImportTrackMode.Link => ResolveResolvedCatalogTrack(
                releaseTracksByTrackId,
                resolvedTrackIdsByDraftTrackId,
                draftTrack),
            ReleaseImportTrackMode.ReleaseOnly => ResolveReleaseOnlyTrackForDraftTrack(release, draftTrack),
            _ => throw ReleaseTrackNotResolved()
        };
    }

    private static ReleaseTrack ResolveResolvedCatalogTrack(
        Dictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId,
        Dictionary<ReleaseImportDraftTrackId, TrackId> resolvedTrackIdsByDraftTrackId,
        ReleaseImportDraftTrack draftTrack)
    {
        return resolvedTrackIdsByDraftTrackId.TryGetValue(draftTrack.Id, out TrackId trackId)
            ? ResolveCatalogBackedReleaseTrack(releaseTracksByTrackId, trackId, draftTrack)
            : throw ReleaseTrackNotResolved();
    }

    private static ReleaseTrack ResolveCatalogBackedReleaseTrack(
        Dictionary<TrackId, ReleaseTrack[]> releaseTracksByTrackId,
        TrackId trackId,
        ReleaseImportDraftTrack draftTrack)
    {
        return releaseTracksByTrackId.TryGetValue(trackId, out ReleaseTrack[]? candidates) && candidates.Length > 0
            ? SelectReleaseTrackByPosition(candidates, draftTrack)
                ?? throw new DomainException("release_import.release_track_ambiguous", "Release import track mapping is ambiguous")
            : throw ReleaseTrackNotResolved();
    }

    private static ReleaseTrack ResolveReleaseOnlyTrackForDraftTrack(Release release, ReleaseImportDraftTrack draftTrack)
    {
        ReleaseTrack[] candidates = [.. release.Tracklist.Where(track => track.IsReleaseOnly)];

        return SelectReleaseTrackByPosition(candidates, draftTrack)
            ?? throw ReleaseTrackNotResolved();
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

    private static DomainException ReleaseTrackNotResolved()
    {
        return new DomainException(ReleaseTrackNotResolvedCode, ReleaseTrackNotResolvedMessage);
    }
}
