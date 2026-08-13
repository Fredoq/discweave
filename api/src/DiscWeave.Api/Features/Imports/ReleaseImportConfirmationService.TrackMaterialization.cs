using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ReleaseImportConfirmationService
{
    private static async Task AddTracksAsync(
        TrackMaterializationScope scope,
        Release release,
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
                    releaseTracks.Count,
                    draftTrack,
                    scope,
                    cancellationToken);
                releaseTracks.Add(releaseOnlyTrack);
                resolvedTrackMaps.ReleaseTrackIdsByDraftTrackId[draftTrack.Id] = releaseOnlyTrack.Id;
                continue;
            }

            Track track = await ResolveTrackAsync(scope.Context, scope.CollectionId, draftTrack, cancellationToken);
            resolvedTracks.Add(new ResolvedDraftTrack(draftTrack, track));
            resolvedTrackMaps.TrackIdsByDraftTrackId[draftTrack.Id] = track.Id;
            var releaseTrack = ReleaseTrack.Create(track.Id, PositionForDraftTrack(releaseTracks.Count, draftTrack));
            releaseTracks.Add(releaseTrack);
            resolvedTrackMaps.ReleaseTrackIdsByDraftTrackId[draftTrack.Id] = releaseTrack.Id;
        }

        IReadOnlyDictionary<TrackId, Credit[]> existingCreditsByTrackId = await LoadExistingTrackCreditsAsync(
            scope.Context,
            scope.CollectionId,
            [.. resolvedTracks.Select(resolved => resolved.Track.Id)],
            cancellationToken);

        foreach (ResolvedDraftTrack resolvedTrack in resolvedTracks)
        {
            await AddTrackCreditsAsync(
                scope,
                resolvedTrack.Track,
                resolvedTrack.DraftTrack,
                existingCreditsByTrackId,
                cancellationToken);
        }

        release.ReplaceTracklist(releaseTracks);
    }

    private static async Task ReconcileTracksAsync(
        TrackMaterializationScope scope,
        Release release,
        IReadOnlyList<ReleaseImportDraftTrack> draftTracks,
        ResolvedTrackMaps resolvedTrackMaps,
        CancellationToken cancellationToken)
    {
        ReleaseTrack[] existingReleaseTracks = [.. release.Tracklist];
        DigitalTrackFileLink[] existingFileLinks = existingReleaseTracks.Length == 0
            ? []
            : await scope.Context.DigitalTrackFileLinks
                .Where(link =>
                    link.CollectionId == scope.CollectionId &&
                    existingReleaseTracks.Select(track => track.Id).Contains(link.ReleaseTrackId))
                .ToArrayAsync(cancellationToken);
        Dictionary<TrackPositionKey, ReleaseTrack> releaseTracksByPosition = existingReleaseTracks
            .ToDictionary(track => TrackPositionKey.From(track.Position));
        List<ResolvedDraftTrack> resolvedTracks = [];
        List<(ReleaseTrackId OldId, ReleaseTrackId NewId)> fileLinkMigrations = [];
        int draftTrackIndex = 0;
        foreach (ReleaseImportDraftTrack draftTrack in draftTracks)
        {
            TrackPosition position = PositionForDraftTrack(draftTrackIndex, draftTrack);
            var positionKey = TrackPositionKey.From(position);
            ReleaseTrack? existingReleaseTrack = releaseTracksByPosition.GetValueOrDefault(positionKey);
            if (draftTrack.TrackMode == ReleaseImportTrackMode.ReleaseOnly)
            {
                ReleaseTrack releaseOnlyReplacement = await CreateReleaseOnlyTrackAsync(
                    draftTrackIndex,
                    draftTrack,
                    scope,
                    cancellationToken);
                releaseTracksByPosition[positionKey] = releaseOnlyReplacement;
                if (existingReleaseTrack is not null)
                {
                    fileLinkMigrations.Add((existingReleaseTrack.Id, releaseOnlyReplacement.Id));
                }

                resolvedTrackMaps.ReleaseTrackIdsByDraftTrackId[draftTrack.Id] = releaseOnlyReplacement.Id;
                draftTrackIndex++;
                continue;
            }

            Track track = await ResolveTrackAsync(scope.Context, scope.CollectionId, draftTrack, cancellationToken);
            resolvedTracks.Add(new ResolvedDraftTrack(draftTrack, track));
            resolvedTrackMaps.TrackIdsByDraftTrackId[draftTrack.Id] = track.Id;
            if (existingReleaseTrack?.TrackId == track.Id)
            {
                resolvedTrackMaps.ReleaseTrackIdsByDraftTrackId[draftTrack.Id] = existingReleaseTrack.Id;
                draftTrackIndex++;
                continue;
            }

            var replacement = ReleaseTrack.Create(track.Id, position);
            releaseTracksByPosition[positionKey] = replacement;
            resolvedTrackMaps.ReleaseTrackIdsByDraftTrackId[draftTrack.Id] = replacement.Id;
            if (existingReleaseTrack is not null)
            {
                fileLinkMigrations.Add((existingReleaseTrack.Id, replacement.Id));
            }

            draftTrackIndex++;
        }

        IReadOnlyDictionary<TrackId, Credit[]> existingCreditsByTrackId = await LoadExistingTrackCreditsAsync(
            scope.Context,
            scope.CollectionId,
            [.. resolvedTracks.Select(resolved => resolved.Track.Id)],
            cancellationToken);
        foreach (ResolvedDraftTrack resolvedTrack in resolvedTracks)
        {
            await AddTrackCreditsAsync(
                scope,
                resolvedTrack.Track,
                resolvedTrack.DraftTrack,
                existingCreditsByTrackId,
                cancellationToken);
        }

        release.ReplaceTracklist([.. releaseTracksByPosition.Values.OrderBy(track => track.Position.Number)]);
        PreserveDigitalFileLinks(scope.Context, scope.CollectionId, existingFileLinks, fileLinkMigrations);
    }

    private static void PreserveDigitalFileLinks(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<DigitalTrackFileLink> existingFileLinks,
        IReadOnlyList<(ReleaseTrackId OldId, ReleaseTrackId NewId)> migrations)
    {
        var newIdsByOldId = migrations
            .GroupBy(migration => migration.OldId)
            .Where(group => group.Select(migration => migration.NewId).Distinct().Count() == 1)
            .ToDictionary(group => group.Key, group => group.Single().NewId);
        foreach (DigitalTrackFileLink existingFileLink in existingFileLinks)
        {
            if (newIdsByOldId.TryGetValue(existingFileLink.ReleaseTrackId, out ReleaseTrackId newReleaseTrackId))
            {
                _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
                    collectionId,
                    DigitalTrackFileLinkId.New(),
                    existingFileLink.DigitalOwnedItemId,
                    newReleaseTrackId,
                    existingFileLink.LocalAudioFileId));
            }
        }
    }

    private readonly record struct TrackPositionKey(int Number)
    {
        public static TrackPositionKey From(TrackPosition position)
        {
            return new TrackPositionKey(position.Number);
        }
    }

    private sealed record TrackMaterializationScope(
        DiscWeaveDbContext Context,
        CollectionId CollectionId,
        ReleaseImportDraft Draft,
        ImportArtistSourceResolutionCache ArtistSourceCache);

    private sealed record ResolvedTrackMaps(
        Dictionary<ReleaseImportDraftTrackId, TrackId> TrackIdsByDraftTrackId,
        Dictionary<ReleaseImportDraftTrackId, ReleaseTrackId> ReleaseTrackIdsByDraftTrackId);

    private static async Task<ReleaseTrack> CreateReleaseOnlyTrackAsync(
        int existingTrackCount,
        ReleaseImportDraftTrack draftTrack,
        TrackMaterializationScope scope,
        CancellationToken cancellationToken)
    {
        return ReleaseTrack.CreateReleaseOnly(
                ReleaseTrackId.New(),
                PositionForDraftTrack(existingTrackCount, draftTrack),
                draftTrack.Title,
                DetailsForDraftTrack(draftTrack))
            .WithArtistCredits(ToReleaseTrackArtistCredits(await ResolveDraftTrackCreditsAsync(
                scope.Context,
                scope.CollectionId,
                scope.Draft,
                draftTrack,
                scope.ArtistSourceCache,
                cancellationToken)));
    }

    private static TrackPosition PositionForDraftTrack(int existingTrackCount, ReleaseImportDraftTrack draftTrack)
    {
        int position = draftTrack.SourceKind == ReleaseImportSourceKind.ExternalMetadata
            ? existingTrackCount + 1
            : draftTrack.Position ?? (existingTrackCount + 1);
        return TrackPosition.FromNumber(
            position,
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
