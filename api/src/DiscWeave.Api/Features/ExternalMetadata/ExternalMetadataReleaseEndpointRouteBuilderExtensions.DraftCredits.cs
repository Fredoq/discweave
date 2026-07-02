using System.Globalization;

using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Features.ExternalMetadata;

public static partial class ExternalMetadataReleaseEndpointRouteBuilderExtensions
{
    private static ExternalMetadataReleaseDraftArtistCreditResponse ToDraftArtistCredit(
        ExternalMetadataArtistReference artist,
        string role)
    {
        return new ExternalMetadataReleaseDraftArtistCreditResponse(
            artist.Name,
            role,
            ToDraftSourceResponse(artist.Source));
    }

    private static ExternalMetadataReleaseDraftArtistCreditResponse ToDraftArtistCredit(
        ExternalMetadataReleaseCredit credit)
    {
        return new ExternalMetadataReleaseDraftArtistCreditResponse(
            credit.Name,
            credit.Role,
            ToDraftSourceResponse(credit.Source));
    }

    private static ExternalMetadataDraftExternalSourceResponse? ToDraftSourceResponse(ExternalMetadataSource? source)
    {
        return source is null
            ? null
            : new ExternalMetadataDraftExternalSourceResponse(
                source.ProviderName,
                source.ResourceType,
                source.ExternalId,
                source.SourceUrl);
    }

    private static ExternalMetadataReleaseDraftResponse ToDraftResponse(ExternalMetadataReleaseDetail detail)
    {
        return new ExternalMetadataReleaseDraftResponse(
            detail.Title,
            detail.Type,
            detail.Genres,
            detail.Year ?? detail.ReleaseDate?.Year,
            detail.ReleaseDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
            [.. DraftArtistReferences(detail).Select(artist => ToDraftArtistCredit(artist, "mainArtist"))],
            DraftLabels(detail),
            [.. detail.Tracklist.Select((track, index) => ToDraftTrackResponse(detail, track, index + 1))],
            [new ExternalMetadataDraftExternalSourceResponse(
                detail.Source.ProviderName,
                detail.Source.ResourceType,
                detail.Source.ExternalId,
                detail.Source.SourceUrl)]);
    }

    private static IReadOnlyList<ExternalMetadataReleaseDraftLabelResponse> DraftLabels(ExternalMetadataReleaseDetail detail)
    {
        return detail.LabelDetails.Count > 0
            ? [.. detail.LabelDetails.Select(label => new ExternalMetadataReleaseDraftLabelResponse(
                label.Name,
                label.CatalogNumber,
                string.IsNullOrWhiteSpace(label.CatalogNumber)))]
            : [.. detail.Labels.Select((label, index) => new ExternalMetadataReleaseDraftLabelResponse(
                label,
                index == 0 ? detail.CatalogNumber : null,
                index != 0 || string.IsNullOrWhiteSpace(detail.CatalogNumber)))];
    }

    private static ExternalMetadataReleaseDraftTrackResponse ToDraftTrackResponse(
        ExternalMetadataReleaseDetail detail,
        ExternalMetadataReleaseTrack track,
        int position)
    {
        return new ExternalMetadataReleaseDraftTrackResponse(
            track.Title,
            position,
            track.Disc,
            track.Side,
            ToDurationSeconds(track.Duration),
            DraftTrackCredits(detail, track));
    }

    private static ExternalMetadataReleaseDraftArtistCreditResponse[] DraftTrackCredits(
        ExternalMetadataReleaseDetail detail,
        ExternalMetadataReleaseTrack track)
    {
        IEnumerable<ExternalMetadataReleaseDraftArtistCreditResponse> mainArtists = DraftArtistReferences(track)
            .Where(artist => !string.IsNullOrWhiteSpace(artist.Name))
            .Select(artist => ToDraftArtistCredit(artist, "mainArtist"));
        IEnumerable<ExternalMetadataReleaseDraftArtistCreditResponse> trackCredits = detail.Credits
            .Where(credit => TrackCreditMatches(credit, track))
            .Where(credit => !string.IsNullOrWhiteSpace(credit.Name))
            .Select(ToDraftArtistCredit);

        return [.. mainArtists.Concat(trackCredits)];
    }

    private static IReadOnlyList<ExternalMetadataArtistReference> DraftArtistReferences(ExternalMetadataReleaseDetail detail)
    {
        return detail.ArtistReferences is { Count: > 0 }
            ? detail.ArtistReferences
            : [.. detail.Artists.Select(artist => new ExternalMetadataArtistReference(artist, null))];
    }

    private static IReadOnlyList<ExternalMetadataArtistReference> DraftArtistReferences(ExternalMetadataReleaseTrack track)
    {
        return track.ArtistReferences is { Count: > 0 }
            ? track.ArtistReferences
            : [.. track.Artists.Select(artist => new ExternalMetadataArtistReference(artist, null))];
    }

    private static bool TrackCreditMatches(ExternalMetadataReleaseCredit credit, ExternalMetadataReleaseTrack track)
    {
        bool hasPosition = !string.IsNullOrWhiteSpace(credit.TrackPosition);
        bool hasTitle = !string.IsNullOrWhiteSpace(credit.TrackTitle);
        if (!hasPosition && !hasTitle)
        {
            return false;
        }

        bool positionMatches = !hasPosition ||
            string.Equals(credit.TrackPosition, track.Position, StringComparison.OrdinalIgnoreCase);
        bool titleMatches = !hasTitle ||
            string.Equals(credit.TrackTitle, track.Title, StringComparison.OrdinalIgnoreCase);

        return positionMatches && titleMatches;
    }
}
