using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static async Task AddTracksAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release release,
        ReleaseImportDraft draft,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        ResolvedTrackMaps resolvedTrackMaps,
        CancellationToken cancellationToken)
    {
        List<ReleaseTrack> releaseTracks = [];
        List<ResolvedDraftTrack> resolvedTracks = [];
        foreach (ReleaseImportDraftTrack draftTrack in draftTracks)
        {
            if (draftTrack.TrackMode == ReleaseImportTrackMode.ReleaseOnly)
            {
                ReleaseTrack releaseOnlyTrack = await CreateReleaseOnlyTrackAsync(
                    context,
                    collectionId,
                    releaseTracks.Count,
                    draft,
                    draftTrack,
                    cancellationToken);
                releaseTracks.Add(releaseOnlyTrack);
                resolvedTrackMaps.ReleaseTrackIdsByDraftTrackId[draftTrack.Id] = releaseOnlyTrack.Id;
                continue;
            }

            Track track = await ResolveTrackAsync(context, collectionId, draftTrack, cancellationToken);
            resolvedTracks.Add(new ResolvedDraftTrack(draftTrack, track));
            resolvedTrackMaps.TrackIdsByDraftTrackId[draftTrack.Id] = track.Id;
            var releaseTrack = ReleaseTrack.Create(track.Id, PositionForDraftTrack(releaseTracks.Count, draftTrack));
            releaseTracks.Add(releaseTrack);
            resolvedTrackMaps.ReleaseTrackIdsByDraftTrackId[draftTrack.Id] = releaseTrack.Id;
        }

        IReadOnlyDictionary<TrackId, Credit[]> existingCreditsByTrackId = await LoadExistingTrackCreditsAsync(
            context,
            collectionId,
            [.. resolvedTracks.Select(resolved => resolved.Track.Id)],
            cancellationToken);

        foreach (ResolvedDraftTrack resolvedTrack in resolvedTracks)
        {
            await AddTrackCreditsAsync(
                context,
                collectionId,
                resolvedTrack.Track,
                draft,
                resolvedTrack.DraftTrack,
                existingCreditsByTrackId,
                cancellationToken);
        }

        release.ReplaceTracklist(releaseTracks);
    }

    private sealed record ResolvedTrackMaps(
        Dictionary<ReleaseImportDraftTrackId, TrackId> TrackIdsByDraftTrackId,
        Dictionary<ReleaseImportDraftTrackId, ReleaseTrackId> ReleaseTrackIdsByDraftTrackId);

    private static async Task<ReleaseTrack> CreateReleaseOnlyTrackAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        int existingTrackCount,
        ReleaseImportDraft draft,
        ReleaseImportDraftTrack draftTrack,
        CancellationToken cancellationToken)
    {
        return ReleaseTrack.CreateReleaseOnly(
                ReleaseTrackId.New(),
                PositionForDraftTrack(existingTrackCount, draftTrack),
                draftTrack.Title,
                DetailsForDraftTrack(draftTrack))
            .WithArtistCredits(ToReleaseTrackArtistCredits(await ResolveDraftTrackCreditsAsync(
                context,
                collectionId,
                draft,
                draftTrack,
                cancellationToken)));
    }

    private static TrackPosition PositionForDraftTrack(int existingTrackCount, ReleaseImportDraftTrack draftTrack)
    {
        return TrackPosition.FromNumber(
            draftTrack.Position ?? (existingTrackCount + 1),
            draftTrack.Disc ?? string.Empty,
            draftTrack.Side ?? string.Empty);
    }

    private static TrackDetails DetailsForDraftTrack(ReleaseImportDraftTrack draftTrack)
    {
        TrackDetails details = TrackDetails.Empty;
        if (draftTrack.Duration is { } duration)
        {
            details = details.WithDuration(duration);
        }

        return details;
    }

    private sealed record ResolvedDraftTrack(ReleaseImportDraftTrack DraftTrack, Track Track);

    private static ReleaseTrackArtistCredit[] ToReleaseTrackArtistCredits(IReadOnlyList<ResolvedImportCredit> credits)
    {
        return
        [
            .. credits.Select(credit => ReleaseTrackArtistCredit.Create(credit.Artist.Id, credit.Roles))
        ];
    }
}
