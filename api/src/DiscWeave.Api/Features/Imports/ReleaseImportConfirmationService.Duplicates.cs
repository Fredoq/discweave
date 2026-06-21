using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    internal static async Task<Release?> FindExistingReleaseForSelectedTracksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        CancellationToken cancellationToken)
    {
        TrackId[] selectedTrackIds = [.. tracks.Select(track => track.SelectedTrackId).Where(id => id.HasValue).Select(id => id!.Value)];
        if (selectedTrackIds.Length != tracks.Length)
        {
            return null;
        }

        Release[] candidates = await context.Releases
            .Include(release => release.Tracklist)
            .Where(release => release.CollectionId == collectionId && release.Summary.Title == draft.Title)
            .ToArrayAsync(cancellationToken);

        return candidates.FirstOrDefault(release =>
            release.Tracklist.Count == selectedTrackIds.Length &&
            release.Tracklist
                .OrderBy(track => track.Position.Number)
                .Select(track => track.TrackId)
                .SequenceEqual(selectedTrackIds));
    }

    internal static async Task<Release?> FindPartialDuplicateReleaseAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack[] tracks,
        CancellationToken cancellationToken)
    {
        TrackId[] selectedTrackIds = [.. tracks.Select(track => track.SelectedTrackId).Where(id => id.HasValue).Select(id => id!.Value)];
        if (selectedTrackIds.Length == 0 || selectedTrackIds.Length >= tracks.Length)
        {
            return null;
        }

        HashSet<TrackId> selectedTrackIdSet = [.. selectedTrackIds];
        Release[] candidates = await context.Releases
            .Include(release => release.Tracklist)
            .Where(release => release.CollectionId == collectionId && release.Summary.Title == draft.Title)
            .ToArrayAsync(cancellationToken);

        return candidates
            .Where(release =>
                release.Tracklist.Count == selectedTrackIdSet.Count &&
                release.Tracklist.All(track => selectedTrackIdSet.Contains(track.TrackId)))
            .OrderByDescending(release => release.Tracklist.Count)
            .FirstOrDefault();
    }

    private static async Task<ReleaseImportDraft?> FindDraftForUpdateAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Guid sessionId,
        Guid draftId,
        CancellationToken cancellationToken)
    {
        var typedSessionId = new ReleaseImportSessionId(sessionId);
        var typedDraftId = new ReleaseImportDraftId(draftId);

        return await context.ReleaseImportDrafts
            .Where(draft =>
                draft.CollectionId == collectionId &&
                draft.SessionId == typedSessionId &&
                draft.Id == typedDraftId)
            .SingleOrDefaultAsync(cancellationToken);
    }
}
