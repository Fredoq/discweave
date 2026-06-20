using DiscWeave.Api.Features.LocalFiles;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Collection;
using DiscWeave.Domain.Credits;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace DiscWeave.Api.Features.Tracks;

public static partial class TracksEndpointRouteBuilderExtensions
{
    private static async Task<Dictionary<TrackId, TrackDigitalFileResponse[]>> LoadDigitalFilesByTrackIdAsync(
        DiscWeaveDbContext context,
        CollectionId collectionId,
        Release[] appearanceReleases,
        Credit[] releaseCredits,
        Dictionary<ArtistId, Artist> artistsById,
        Dictionary<LabelId, Label> labelsById,
        TrackId[] trackIds,
        CancellationToken cancellationToken)
    {
        if (appearanceReleases.Length == 0 || trackIds.Length == 0)
        {
            return [];
        }

        TrackDigitalFileContext[] releaseTrackContexts =
        [
            .. appearanceReleases.SelectMany(release => release.Tracklist
                .Where(releaseTrack => trackIds.Contains(releaseTrack.TrackId))
                .Select(releaseTrack => new TrackDigitalFileContext(release, releaseTrack)))
        ];
        if (releaseTrackContexts.Length == 0)
        {
            return [];
        }

        ReleaseTrackId[] releaseTrackIds = [.. releaseTrackContexts.Select(contextRow => contextRow.ReleaseTrack.Id).Distinct()];
        DigitalTrackFileLink[] links = await context.DigitalTrackFileLinks.AsNoTracking()
            .Where(link => link.CollectionId == collectionId && releaseTrackIds.Contains(link.ReleaseTrackId))
            .ToArrayAsync(cancellationToken);
        if (links.Length == 0)
        {
            return [];
        }

        LocalAudioFileId[] localAudioFileIds = [.. links.Select(link => link.LocalAudioFileId).Distinct()];
        Dictionary<LocalAudioFileId, LocalAudioFile> filesById = await context.LocalAudioFiles.AsNoTracking()
            .Where(file => file.CollectionId == collectionId && localAudioFileIds.Contains(file.Id))
            .ToDictionaryAsync(file => file.Id, cancellationToken);
        Dictionary<ReleaseTrackId, TrackDigitalFileContext> contextsByReleaseTrackId = releaseTrackContexts
            .ToDictionary(contextRow => contextRow.ReleaseTrack.Id);

        var responsesByTrackId = new Dictionary<TrackId, List<TrackDigitalFileResponse>>();
        foreach (DigitalTrackFileLink link in links)
        {
            if (!filesById.TryGetValue(link.LocalAudioFileId, out LocalAudioFile? file) ||
                !contextsByReleaseTrackId.TryGetValue(link.ReleaseTrackId, out TrackDigitalFileContext? contextRow))
            {
                continue;
            }

            TrackId trackId = contextRow.ReleaseTrack.TrackId;
            if (!responsesByTrackId.TryGetValue(trackId, out List<TrackDigitalFileResponse>? responses))
            {
                responses = [];
                responsesByTrackId[trackId] = responses;
            }

            responses.Add(ToTrackDigitalFileResponse(
                link,
                contextRow.Release,
                contextRow.ReleaseTrack,
                file,
                releaseCredits,
                artistsById,
                labelsById));
        }

        return responsesByTrackId.ToDictionary(
            pair => pair.Key,
            pair => pair.Value
                .OrderBy(response => response.ReleaseTitle, StringComparer.OrdinalIgnoreCase)
                .ThenBy(response => response.Position)
                .ThenBy(response => response.Path, StringComparer.OrdinalIgnoreCase)
                .ToArray());
    }

    private static TrackDigitalFileResponse ToTrackDigitalFileResponse(
        DigitalTrackFileLink link,
        Release release,
        ReleaseTrack releaseTrack,
        LocalAudioFile file,
        IReadOnlyList<Credit> releaseCredits,
        Dictionary<ArtistId, Artist> artistsById,
        Dictionary<LabelId, Label> labelsById)
    {
        Credit[] credits =
        [
            .. releaseCredits.Where(credit => credit.Target is ReleaseCreditTarget target && target.ReleaseId == release.Id)
        ];
        string releaseArtist = release.IsVariousArtists
            ? "Various Artists"
            : FormatReleaseArtists(credits, artistsById);
        ReleaseLabel? releaseLabel = release.Labels.Count > 0 ? release.Labels[0] : null;
        LocalAudioFileFields fields = LocalAudioFileContractMapper.ToFields(file);

        return new TrackDigitalFileResponse(
            link.Id.Value,
            fields.Id,
            link.DigitalOwnedItemId.Value,
            release.Id.Value,
            release.Summary.Title,
            releaseArtist,
            ToReleaseYear(release),
            OptionalReleaseDate(release),
            releaseLabel is not null ? FormatLabel(releaseLabel, labelsById) : null,
            releaseLabel is not null ? OptionalString(releaseLabel.CatalogNumber) : null,
            releaseTrack.Id.Value,
            releaseTrack.Position.Number,
            OptionalString(releaseTrack.Position.Disc),
            OptionalString(releaseTrack.Position.Side),
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

    private static string? OptionalReleaseDate(Release release)
    {
        return release.Summary.Metadata.ReleaseDate.HasValue
            ? release.Summary.Metadata.ReleaseDate.Match(value => value.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), () => string.Empty)
            : null;
    }

    private sealed record TrackDigitalFileContext(Release Release, ReleaseTrack ReleaseTrack);
}
