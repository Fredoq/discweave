using DiscWeave.Api.Features.LocalFiles;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.OwnedItems;

internal static partial class OwnedItemResponseMapper
{
    private static async Task<Dictionary<OwnedItemId, DigitalFileCoverageResponse[]>> LoadDigitalFileCoverageAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        IReadOnlyList<OwnedItem> items,
        IReadOnlyDictionary<ReleaseId, Release> releasesById,
        CancellationToken cancellationToken)
    {
        OwnedItemId[] digitalOwnedItemIds =
        [
            .. items
                .Where(item => item.Holding.Medium is DigitalFile)
                .Select(item => item.Id)
                .Distinct()
        ];
        if (digitalOwnedItemIds.Length == 0)
        {
            return [];
        }

        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && digitalOwnedItemIds.Contains(link.DigitalOwnedItemId))
            .ToArrayAsync(cancellationToken);
        if (links.Length == 0)
        {
            return [];
        }

        LocalAudioFileId[] localAudioFileIds = [.. links.Select(link => link.LocalAudioFileId).Distinct()];
        Dictionary<LocalAudioFileId, LocalAudioFile> filesById = await context.LocalAudioFiles.AsNoTracking()
            .Where(file => file.CollectionId == collectionId && localAudioFileIds.Contains(file.Id))
            .ToDictionaryAsync(file => file.Id, cancellationToken);

        var releaseTracksById = releasesById.Values
            .SelectMany(release => release.Tracklist)
            .ToDictionary(releaseTrack => releaseTrack.Id);
        TrackId[] trackIds =
        [
                .. releaseTracksById.Values
                    .Where(releaseTrack => links.Any(link => link.ReleaseTrackId == releaseTrack.Id))
                    .Select(releaseTrack => releaseTrack.TrackId)
                    .Where(trackId => trackId.HasValue)
                    .Select(trackId => trackId!.Value)
                    .Distinct()
        ];
        Dictionary<TrackId, Track> tracksById = trackIds.Length == 0
            ? []
            : await context.Tracks.AsNoTracking()
                .Where(track => track.CollectionId == collectionId && trackIds.Contains(track.Id))
                .ToDictionaryAsync(track => track.Id, cancellationToken);

        var responsesByOwnedItemId = new Dictionary<OwnedItemId, List<DigitalFileCoverageResponse>>();
        foreach (DigitalTrackFileLink link in links)
        {
            if (!filesById.TryGetValue(link.LocalAudioFileId, out LocalAudioFile? file) ||
                !releaseTracksById.TryGetValue(link.ReleaseTrackId, out ReleaseTrack? releaseTrack))
            {
                continue;
            }

            if (!responsesByOwnedItemId.TryGetValue(link.DigitalOwnedItemId, out List<DigitalFileCoverageResponse>? responses))
            {
                responses = [];
                responsesByOwnedItemId[link.DigitalOwnedItemId] = responses;
            }

            responses.Add(ToDigitalFileCoverageResponse(link, releaseTrack, file, tracksById));
        }

        return responsesByOwnedItemId.ToDictionary(
            pair => pair.Key,
            pair => pair.Value
                .OrderBy(response => response.Position)
                .ThenBy(response => response.Path, StringComparer.OrdinalIgnoreCase)
                .ToArray());
    }

    private static DigitalFileCoverageResponse ToDigitalFileCoverageResponse(
        DigitalTrackFileLink link,
        ReleaseTrack releaseTrack,
        LocalAudioFile file,
        Dictionary<TrackId, Track> tracksById)
    {
        LocalAudioFileFields fields = LocalAudioFileContractMapper.ToFields(file);
        TrackId? trackId = releaseTrack.TrackId;

        return new DigitalFileCoverageResponse(
            link.Id.Value,
            releaseTrack.Id.Value,
            trackId?.Value,
            TrackTitle(releaseTrack, trackId, tracksById),
            releaseTrack.Position.Number,
            OptionalString(releaseTrack.Position.Disc),
            OptionalString(releaseTrack.Position.Side),
            fields.Id,
            fields.Path,
            fields.Format,
            fields.Codec,
            fields.Quality,
            fields.SizeBytes,
            fields.ModifiedAt,
            fields.ContentHash,
            fields.DurationSeconds,
            fields.BitrateKbps,
            fields.SampleRateHz,
            fields.Channels);
    }

    private static string TrackTitle(
        ReleaseTrack releaseTrack,
        TrackId? trackId,
        Dictionary<TrackId, Track> tracksById)
    {
        return trackId is not null && tracksById.TryGetValue(trackId.Value, out Track? track)
            ? track.Title
            : OptionalString(releaseTrack.TitleOverride) ?? "Unknown track";
    }

    private static string? OptionalString(IOptionalValue<string>? value)
    {
        return value is { HasValue: true } ? value.Match(present => present, () => string.Empty) : null;
    }
}
