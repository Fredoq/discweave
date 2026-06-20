using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace DiscWeave.Api.Features.Releases;

public static partial class ReleasesEndpointRouteBuilderExtensions
{
    private static async Task<DigitalTrackFileLink[]> LoadDigitalFileLinksForReleaseTracklistAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        ReleaseTrack[] existingReleaseTracks,
        CancellationToken cancellationToken)
    {
        ReleaseTrackId[] existingReleaseTrackIds = [.. existingReleaseTracks.Select(track => track.Id)];
        return existingReleaseTrackIds.Length == 0
            ? []
            : await context.DigitalTrackFileLinks
                .Where(link =>
                    link.CollectionId == collectionId &&
                    existingReleaseTrackIds.Contains(link.ReleaseTrackId))
                .ToArrayAsync(cancellationToken);
    }

    private static void PreserveDigitalFileLinksForReplacedTracklist(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        DigitalTrackFileLink[] existingFileLinks,
        IReadOnlyList<ReleaseTrackFileLinkMigration> fileLinkMigrations)
    {
        if (existingFileLinks.Length == 0 || fileLinkMigrations.Count == 0)
        {
            return;
        }

        var newReleaseTrackIdsByOldId = fileLinkMigrations
            .GroupBy(migration => migration.OldReleaseTrackId)
            .Where(group => group.Select(migration => migration.NewReleaseTrackId).Distinct().Count() == 1)
            .ToDictionary(group => group.Key, group => group.Single().NewReleaseTrackId);

        foreach (DigitalTrackFileLink existingFileLink in existingFileLinks)
        {
            if (!newReleaseTrackIdsByOldId.TryGetValue(existingFileLink.ReleaseTrackId, out ReleaseTrackId newReleaseTrackId))
            {
                continue;
            }

            _ = context.DigitalTrackFileLinks.Add(DigitalTrackFileLink.Create(
                collectionId,
                DigitalTrackFileLinkId.New(),
                existingFileLink.DigitalOwnedItemId,
                newReleaseTrackId,
                existingFileLink.LocalAudioFileId));
        }
    }

    private readonly record struct ReleaseTrackFileLinkMigration(
        ReleaseTrackId OldReleaseTrackId,
        ReleaseTrackId NewReleaseTrackId);

    private readonly record struct ReleaseTrackPositionKey(string Disc, string Side, int Number)
    {
        public static ReleaseTrackPositionKey From(TrackPosition position)
        {
            return new ReleaseTrackPositionKey(
                OptionalMarkerOrEmpty(position.Disc),
                OptionalMarkerOrEmpty(position.Side),
                position.Number);
        }

        public static ReleaseTrackPositionKey From(ReleaseTrackRequest request)
        {
            return new ReleaseTrackPositionKey(request.Disc ?? string.Empty, request.Side ?? string.Empty, request.Position);
        }

        private static string OptionalMarkerOrEmpty(IOptionalValue<string>? marker)
        {
            return marker?.Match(value => value, () => string.Empty) ?? string.Empty;
        }
    }
}
