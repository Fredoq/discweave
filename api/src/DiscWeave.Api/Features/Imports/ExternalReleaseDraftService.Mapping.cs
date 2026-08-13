using System.Globalization;
using DiscWeave.Application.Catalog;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.Catalog;
using DiscWeave.Domain.Imports;
using DiscWeave.Domain.SharedKernel.Ids;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Api.Features.Imports;

public sealed partial class ExternalReleaseDraftService
{
    private async Task<ReleaseId[]> FindReleaseIdsAsync(
        CollectionId collectionId,
        ReleaseImportProviderReference recordingSource,
        ExternalReleaseRoute route,
        CancellationToken cancellationToken)
    {
        List<ExternalSourceLookupIdentity> identities =
        [
            ExternalSourceLookupIdentity.Create(
                route.MusicBrainzRelease.ProviderCode,
                route.MusicBrainzRelease.ResourceType,
                route.MusicBrainzRelease.ExternalId)
        ];
        _ = route.DiscogsRelease.Match(
            source =>
            {
                identities.Add(ExternalSourceLookupIdentity.Create(
                    source.ProviderCode,
                    source.ResourceType,
                    source.ExternalId));
                return true;
            },
            () => true);
        _ = recordingSource;
        IReadOnlyList<Release> releases = await _sourceLookup.FindReleasesAsync(
            collectionId,
            identities,
            cancellationToken);
        return [.. releases.Select(release => release.Id)];
    }

    private async Task<TrackId[]> FindTrackIdsAsync(
        CollectionId collectionId,
        ReleaseImportProviderReference recordingSource,
        MusicBrainzReleaseRowLocator musicBrainzRow,
        CancellationToken cancellationToken)
    {
        ExternalSourceLookupIdentity[] identities =
        [
            ExternalSourceLookupIdentity.Create(
                recordingSource.ProviderCode,
                recordingSource.ResourceType,
                recordingSource.ExternalId),
            ExternalSourceLookupIdentity.Create(
                "musicbrainz",
                "track",
                musicBrainzRow.TrackMbid)
        ];
        IReadOnlyList<Track> tracks = await _sourceLookup.FindTracksAsync(
            collectionId,
            identities,
            cancellationToken);
        return [.. tracks.Select(track => track.Id)];
    }

    private static ReleaseImportDraftEditableFields ToDraftFields(
        ExternalMetadataReleaseDetail release)
    {
        return new ReleaseImportDraftEditableFields(
            release.Title,
            release.Type ?? "unknown",
            ToOptional(release.CatalogNumber),
            ToOptional(release.Labels.Count > 0 ? release.Labels[0] : null),
            ToOptional(release.ReleaseDate),
            ToOptional(release.Year),
            release.Artists.Count > 1 && release.Artists.Any(artist =>
                artist.Contains("various", StringComparison.OrdinalIgnoreCase)),
            release.Labels.Count == 0,
            Optional.Missing<string>(),
            release.Artists,
            [.. release.Artists.Select(name => new ReleaseImportArtistCredit(null, name, "mainArtist"))],
            [.. release.Labels.Select(name => new ReleaseImportLabel(null, name, release.CatalogNumber, string.IsNullOrWhiteSpace(release.CatalogNumber)))],
            [],
            release.Genres,
            [],
            true,
            []);
    }

    private static DraftTrackEditableFields ToTrackFields(
        ExternalMetadataReleaseTrack track,
        int fallbackPosition,
        int? releaseYear,
        ReleaseImportTrackMode mode,
        TrackId? selectedTrackId,
        bool isOriginal)
    {
        int? position = int.TryParse(track.Position, NumberStyles.Integer, CultureInfo.InvariantCulture, out int parsed) && parsed > 0
            ? parsed
            : null;
        return new DraftTrackEditableFields(
            position ?? fallbackPosition,
            track.Disc,
            track.Side,
            track.Title,
            track.Duration,
            releaseYear,
            track.Artists,
            [.. track.Artists.Select(name => new ReleaseImportArtistCredit(null, name, "mainArtist"))],
            track.Artists.Count == 0,
            [],
            mode,
            selectedTrackId,
            false,
            [],
            isOriginal);
    }

    private static bool HasMusicBrainzTrack(
        ExternalMetadataReleaseTrack row,
        string trackMbid)
    {
        return row.ExternalSources.Any(source =>
            source.ProviderName == "musicbrainz" &&
            source.ResourceType == "track" &&
            string.Equals(source.ExternalId, trackMbid, StringComparison.OrdinalIgnoreCase));
    }

    private static IOptionalValue<T> ToOptional<T>(T? value)
        where T : struct
    {
        return value is { } present ? Optional.From(present) : Optional.Missing<T>();
    }

    private static IOptionalValue<string> ToOptional(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? Optional.Missing<string>() : Optional.From(value);
    }

}
