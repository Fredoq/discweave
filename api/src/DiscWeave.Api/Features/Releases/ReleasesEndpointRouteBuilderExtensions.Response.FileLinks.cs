using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static ReleaseTracklistItemResponse ToTracklistItemResponse(
        ReleaseTrack releaseTrack,
        Dictionary<TrackId, Track> tracksById,
        IReadOnlyList<Credit> trackCredits,
        IReadOnlyDictionary<ArtistId, Artist> artistsById,
        IReadOnlyDictionary<ReleaseTrackId, IReadOnlyList<ReleaseTrackLinkedLocalFileResponse>> linkedFilesByReleaseTrackId)
    {
        _ = tracksById.TryGetValue(releaseTrack.TrackId, out Track? track);
        Credit[] credits = [.. trackCredits.Where(credit => credit.Target is TrackCreditTarget target && target.TrackId == releaseTrack.TrackId)];
        int? durationSeconds = track is not null && track.Details.Duration.HasValue
            ? track.Details.Duration.Match(value => (int)value.TotalSeconds, () => 0)
            : null;

        return new ReleaseTracklistItemResponse(
            releaseTrack.TrackId.Value,
            track?.Title ?? "Unknown track",
            releaseTrack.Position.Number,
            OptionalString(releaseTrack.Position.Disc),
            OptionalString(releaseTrack.Position.Side),
            durationSeconds,
            [.. credits.Select(credit => ToArtistCreditResponse(credit, artistsById))],
            linkedFilesByReleaseTrackId.GetValueOrDefault(releaseTrack.Id, []),
            releaseTrack.Id.Value);
    }

    private static async Task<Dictionary<ReleaseTrackId, IReadOnlyList<ReleaseTrackLinkedLocalFileResponse>>> LoadLinkedLocalFilesByReleaseTrackIdAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseTrackId[] releaseTrackIds,
        CancellationToken cancellationToken)
    {
        if (releaseTrackIds.Length == 0)
        {
            return [];
        }

        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && releaseTrackIds.Contains(link.ReleaseTrackId))
            .ToArrayAsync(cancellationToken);
        LocalAudioFileId[] localFileIds = [.. links.Select(link => link.LocalAudioFileId).Distinct()];
        Dictionary<LocalAudioFileId, LocalAudioFile> localFilesById = localFileIds.Length == 0
            ? []
            : await context.LocalAudioFiles.AsNoTracking()
                .Where(file => file.CollectionId == collectionId && localFileIds.Contains(file.Id))
                .ToDictionaryAsync(file => file.Id, cancellationToken);

        return links
            .GroupBy(link => link.ReleaseTrackId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<ReleaseTrackLinkedLocalFileResponse>)[
                    .. group
                        .OrderBy(link => link.Id.Value)
                        .Select(link => ToLinkedLocalFileResponse(link, localFilesById))
                        .Where(response => response is not null)
                        .Select(response => response!)
                ]);
    }

    private static ReleaseTrackLinkedLocalFileResponse? ToLinkedLocalFileResponse(
        DigitalTrackFileLink link,
        Dictionary<LocalAudioFileId, LocalAudioFile> localFilesById)
    {
        if (!localFilesById.TryGetValue(link.LocalAudioFileId, out LocalAudioFile? localFile))
        {
            return null;
        }

        string? format = null;
        if (localFile.Format is { HasValue: true } localFileFormat)
        {
            format = localFileFormat.Match(value => value.ToString().ToLowerInvariant(), () => string.Empty);
        }

        return new ReleaseTrackLinkedLocalFileResponse(
            localFile.Id.Value,
            localFile.Path.Value,
            OptionalString(localFile.ContentHash),
            format);
    }
}
