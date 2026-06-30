using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static async Task ReplaceReleaseTracklistAsync(
        ReleaseRequest request,
        Release release,
        IReadOnlyList<ResolvedCredit> releaseCredits,
        DiscWeaveDbContext context,
        CollectionId collectionId,
        CancellationToken cancellationToken)
    {
        EnsureTracklistHasNoDuplicateTrackIds(request.Tracklist ?? []);

        ReleaseTrack[] existingReleaseTracks = [.. release.Tracklist];
        DigitalTrackFileLink[] existingFileLinks = await LoadDigitalFileLinksForReleaseTracklistAsync(
            context,
            collectionId,
            existingReleaseTracks,
            cancellationToken);
        var existingReleaseTracksByPosition = existingReleaseTracks
            .GroupBy(releaseTrack => ReleaseTrackPositionKey.From(releaseTrack.Position))
            .ToDictionary(group => group.Key, group => group.First());
        var uniqueExistingReleaseTracksByTrackId = existingReleaseTracks
            .Where(releaseTrack => releaseTrack.TrackId.HasValue)
            .GroupBy(releaseTrack => releaseTrack.TrackId!.Value)
            .Where(group => group.Count() == 1)
            .ToDictionary(group => group.Key, group => group.Single());
        TrackId[] existingTrackIds =
        [
            .. existingReleaseTracksByPosition.Values
                .Select(releaseTrack => releaseTrack.TrackId)
                .Where(trackId => trackId.HasValue)
                .Select(trackId => trackId!.Value)
                .Distinct()
        ];
        Dictionary<TrackId, Track> existingTracksById = existingTrackIds.Length == 0
            ? []
            : await context.Tracks
                .Where(track => track.CollectionId == collectionId && existingTrackIds.Contains(track.Id))
                .ToDictionaryAsync(track => track.Id, cancellationToken);
        var replacementContext = new ReleaseTracklistReplacementContext(
            request,
            releaseCredits,
            context,
            collectionId,
            existingReleaseTracksByPosition,
            uniqueExistingReleaseTracksByTrackId,
            existingTracksById,
            [],
            cancellationToken);
        var releaseTracks = new List<ReleaseTrack>();
        var fileLinkMigrations = new List<ReleaseTrackFileLinkMigration>();
        foreach (ReleaseTrackRequest trackRequest in request.Tracklist ?? [])
        {
            string trackMode = NormalizeTrackMode(trackRequest);
            var position = TrackPosition.FromNumber(trackRequest.Position, trackRequest.Disc ?? string.Empty, trackRequest.Side ?? string.Empty);
            if (trackMode == ReleaseOnlyTrackMode)
            {
                releaseTracks.Add(await CreateReleaseOnlyTrackAsync(trackRequest, position, replacementContext));
                continue;
            }

            CatalogBackedReleaseTrackResult result = await CreateCatalogBackedReleaseTrackAsync(
                trackMode,
                trackRequest,
                position,
                replacementContext);
            releaseTracks.Add(result.ReleaseTrack);
            if (result.FileLinkSource is not null)
            {
                fileLinkMigrations.Add(new ReleaseTrackFileLinkMigration(result.FileLinkSource.Id, result.ReleaseTrack.Id));
            }
        }

        release.ReplaceTracklist(releaseTracks);
        PreserveDigitalFileLinksForReplacedTracklist(context, collectionId, existingFileLinks, fileLinkMigrations);
    }

    private static async Task<ReleaseTrack> CreateReleaseOnlyTrackAsync(
        ReleaseTrackRequest trackRequest,
        TrackPosition position,
        ReleaseTracklistReplacementContext replacementContext)
    {
        IReadOnlyList<ResolvedCredit> releaseTrackCredits = await ResolveTrackCreditsAsync(
            trackRequest.ArtistCredits,
            ShouldInheritReleaseArtistCredits(trackRequest, allowDefaultInheritance: true),
            replacementContext.ReleaseCredits,
            replacementContext.Request.IsVariousArtists,
            replacementContext.Context,
            replacementContext.CollectionId,
            replacementContext.CancellationToken);

        return ReleaseTrack.CreateReleaseOnly(
                ReleaseTrackId.New(),
                position,
                RequiredTrackTitle(trackRequest),
                TrackDetailsFromRequest(trackRequest))
            .WithArtistCredits(ToReleaseTrackArtistCredits(releaseTrackCredits));
    }

    private static async Task<CatalogBackedReleaseTrackResult> CreateCatalogBackedReleaseTrackAsync(
        string trackMode,
        ReleaseTrackRequest trackRequest,
        TrackPosition position,
        ReleaseTracklistReplacementContext replacementContext)
    {
        CatalogTrackResolution resolution = trackMode == LinkTrackMode
            ? await ResolveLinkedTrackAsync(trackRequest, replacementContext)
            : await ResolveCreatedOrOverlaidTrackAsync(trackRequest, replacementContext);
        var releaseTrack = ReleaseTrack.Create(
            resolution.Track.Id,
            position,
            Optional.Missing<string>());

        return new CatalogBackedReleaseTrackResult(releaseTrack, resolution.FileLinkSource);
    }

    private static async Task<CatalogTrackResolution> ResolveLinkedTrackAsync(
        ReleaseTrackRequest trackRequest,
        ReleaseTracklistReplacementContext replacementContext)
    {
        Guid trackId = trackRequest.TrackId
            ?? throw new DomainException("release_track.track_id_required", "Release track with link mode must include trackId");
        EnsureExistingTrackRequestHasNoExternalSources(trackRequest);
        var requestedTrackId = new TrackId(trackId);
        Track track = await replacementContext.Context.Tracks.SingleOrDefaultAsync(
            entity => entity.CollectionId == replacementContext.CollectionId && entity.Id == requestedTrackId,
            replacementContext.CancellationToken)
            ?? throw new DomainException("release_track.track_conflict", "Release track does not exist");
        ApplyOptionalLinkedTrackRequestMetadata(track, trackRequest);
        await AddMissingTrackCreditsAsync(
            track,
            trackRequest,
            replacementContext.ReleaseCredits,
            replacementContext.Request.IsVariousArtists,
            replacementContext.Context,
            replacementContext.CollectionId,
            replacementContext.CancellationToken);

        return new CatalogTrackResolution(
            track,
            replacementContext.UniqueExistingReleaseTracksByTrackId.GetValueOrDefault(requestedTrackId));
    }

    private static async Task<CatalogTrackResolution> ResolveCreatedOrOverlaidTrackAsync(
        ReleaseTrackRequest trackRequest,
        ReleaseTracklistReplacementContext replacementContext)
    {
        var positionKey = ReleaseTrackPositionKey.From(trackRequest);
        if (replacementContext.ExistingReleaseTracksByPosition.TryGetValue(positionKey, out ReleaseTrack? existingReleaseTrack) &&
            existingReleaseTrack.TrackId is { } existingTrackId &&
            replacementContext.ExistingTracksById.TryGetValue(existingTrackId, out Track? existingTrack) &&
            replacementContext.OverlaidPositions.Add(positionKey))
        {
            ApplyTrackRequestMetadata(existingTrack, trackRequest, replacementContext.Request.Year);
            await ReplaceTrackCreditsAsync(
                existingTrack,
                trackRequest,
                replacementContext.ReleaseCredits,
                replacementContext.Request.IsVariousArtists,
                replacementContext.Context,
                replacementContext.CollectionId,
                replacementContext.CancellationToken);

            return new CatalogTrackResolution(existingTrack, existingReleaseTrack);
        }

        var track = Track.Create(replacementContext.CollectionId, TrackId.New(), RequiredTrackTitle(trackRequest));
        ApplyTrackRequestMetadata(track, trackRequest, replacementContext.Request.Year);
        _ = replacementContext.Context.Tracks.Add(track);
        await AddTrackCreditsAsync(
            track,
            trackRequest,
            replacementContext.ReleaseCredits,
            replacementContext.Request.IsVariousArtists,
            replacementContext.Context,
            replacementContext.CollectionId,
            replacementContext.CancellationToken);

        return new CatalogTrackResolution(track, null);
    }

    private sealed record ReleaseTracklistReplacementContext(
        ReleaseRequest Request,
        IReadOnlyList<ResolvedCredit> ReleaseCredits,
        DiscWeaveDbContext Context,
        CollectionId CollectionId,
        IReadOnlyDictionary<ReleaseTrackPositionKey, ReleaseTrack> ExistingReleaseTracksByPosition,
        IReadOnlyDictionary<TrackId, ReleaseTrack> UniqueExistingReleaseTracksByTrackId,
        IReadOnlyDictionary<TrackId, Track> ExistingTracksById,
        HashSet<ReleaseTrackPositionKey> OverlaidPositions,
        CancellationToken CancellationToken);

    private sealed record CatalogTrackResolution(Track Track, ReleaseTrack? FileLinkSource);

    private sealed record CatalogBackedReleaseTrackResult(ReleaseTrack ReleaseTrack, ReleaseTrack? FileLinkSource);
}
