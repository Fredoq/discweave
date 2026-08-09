using System.Globalization;
using System.Text.RegularExpressions;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Infrastructure.ExternalMetadata.MusicBrainz;

public sealed partial class MusicBrainzExternalMetadataProvider
{
    private const string DiscogsReleaseRelationshipId = "4a78823c-1c53-4176-a5f3-58026c76f2bc";

    private static bool TryMapReleaseDetail(
        ReleaseDto release,
        string expectedMbid,
        out ExternalMetadataReleaseDetail detail)
    {
        if (!TryNormalizeMbid(release.Id, out string releaseMbid) ||
            !string.Equals(releaseMbid, expectedMbid, StringComparison.Ordinal) ||
            string.IsNullOrWhiteSpace(release.Title))
        {
            detail = null!;
            return false;
        }

        ExternalMetadataReleaseTrack[] tracks =
        [
            .. (release.Media ?? [])
                .SelectMany(medium => (medium.Tracks ?? [])
                    .Select(track => TryMapReleaseTrack(medium, track, null)))
                .Where(track => track is not null)
                .Select(track => track!)
        ];
        ExternalMetadataReleaseLabel[] labels =
        [
            .. (release.LabelInfo ?? [])
                .Select(info => new ExternalMetadataReleaseLabel(
                    EmptyToNull(info.Label?.Name) ?? string.Empty,
                    EmptyToNull(info.CatalogNumber)))
                .Where(label => !string.IsNullOrWhiteSpace(label.Name))
        ];
        string[] labelNames = [.. labels.Select(label => label.Name).Distinct(StringComparer.Ordinal)];
        string[] formats =
        [
            .. (release.Media ?? [])
                .Select(medium => EmptyToNull(medium.Format))
                .Where(format => format is not null)
                .Select(format => format!)
                .Distinct(StringComparer.Ordinal)
        ];
        ExternalMetadataIdentifier[] identifiers = string.IsNullOrWhiteSpace(release.Barcode)
            ? []
            : [new ExternalMetadataIdentifier("Barcode", release.Barcode.Trim())];

        IOptionalValue<ExternalMetadataPartialDate> dateEvidence =
            ParseReleaseDateEvidence(release.Date);
        int sourceTrackCount = (release.Media ?? [])
            .Sum(medium => medium.Tracks?.Count ?? 0);
        bool tracklistComplete =
            release.Media is { Count: > 0 } media &&
            media.All(medium => medium.Tracks is { Count: > 0 }) &&
            tracks.Length == sourceTrackCount;
        detail = new ExternalMetadataReleaseDetail(
            MusicBrainzSource("release", releaseMbid),
            release.Title.Trim(),
            ArtistNames(release.ArtistCredit),
            null,
            null,
            labelNames,
            formats,
            EmptyToNull(release.ReleaseGroup?.PrimaryType)?.ToLowerInvariant(),
            [],
            tracks,
            identifiers,
            labels.Select(label => label.CatalogNumber).FirstOrDefault(value => value is not null),
            labels,
            [],
            ArtistReferences(release.ArtistCredit),
            MapRelatedSources(release.Relations),
            dateEvidence,
            tracklistComplete);
        return true;
    }

    private static ExternalMetadataReleaseTrack? TryMapReleaseTrack(
        MediumDto medium,
        TrackDto track,
        string? expectedRecordingMbid)
    {
        if (medium.Position is not > 0 ||
            !TryNormalizeMbid(track.Id, out string trackMbid) ||
            !TryNormalizeMbid(track.Recording?.Id, out string recordingMbid) ||
            (expectedRecordingMbid is not null &&
                !string.Equals(recordingMbid, expectedRecordingMbid, StringComparison.Ordinal)))
        {
            return null;
        }

        string? title = EmptyToNull(track.Title) ?? EmptyToNull(track.Recording?.Title);
        if (title is null)
        {
            return null;
        }

        IReadOnlyList<ArtistCreditDto>? credits = track.ArtistCredit is { Count: > 0 }
            ? track.ArtistCredit
            : track.Recording?.ArtistCredit;
        string? position = EmptyToNull(track.Number) ??
            track.Position?.ToString(CultureInfo.InvariantCulture);

        return new ExternalMetadataReleaseTrack(
            title,
            position,
            Duration(track.Length),
            ArtistNames(credits),
            medium.Position.Value.ToString(CultureInfo.InvariantCulture),
            null,
            ArtistReferences(credits),
            [
                MusicBrainzSource("track", trackMbid),
                MusicBrainzSource("recording", recordingMbid)
            ]);
    }

    private static bool TryMapReleaseRoute(
        ReleaseDto release,
        string? expectedRecordingMbid,
        out ReleaseRoute route,
        out bool invalidRows)
    {
        invalidRows = false;
        if (!TryNormalizeMbid(release.Id, out string releaseMbid) ||
            string.IsNullOrWhiteSpace(release.Title))
        {
            route = null!;
            invalidRows = true;
            return false;
        }

        var tracks = new List<ExternalMetadataReleaseTrack>();
        foreach (MediumDto medium in release.Media ?? [])
        {
            foreach (TrackDto track in medium.Tracks ?? [])
            {
                ExternalMetadataReleaseTrack? mapped = TryMapReleaseTrack(
                    medium,
                    track,
                    expectedRecordingMbid);
                if (mapped is null)
                {
                    invalidRows = true;
                }
                else
                {
                    tracks.Add(mapped);
                }
            }
        }

        if (tracks.Count == 0)
        {
            route = null!;
            invalidRows = true;
            return false;
        }

        string? groupMbid = TryNormalizeMbid(release.ReleaseGroup?.Id, out string normalizedGroup)
            ? normalizedGroup
            : null;
        route = new ReleaseRoute(
            releaseMbid,
            release.Title.Trim(),
            ParseReleaseDate(release.Date),
            ParseProviderPartialDate(release.Date),
            groupMbid,
            tracks,
            MapRelatedSources(release.Relations),
            EmptyToNull(release.Status),
            EmptyToNull(release.Country),
            EmptyToNull(release.ReleaseGroup?.PrimaryType),
            [.. (release.ReleaseGroup?.SecondaryTypes ?? [])
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim())],
            ArtistNames(release.ArtistCredit),
            [.. (release.LabelInfo ?? [])
                .Select(info => info.Label?.Name?.Trim())
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Select(name => name!)
                .Distinct(StringComparer.OrdinalIgnoreCase)],
            [.. (release.Media ?? [])
                .Select(medium => medium.Format?.Trim())
                .Where(format => !string.IsNullOrWhiteSpace(format))
                .Select(format => format!)
                .Distinct(StringComparer.OrdinalIgnoreCase)],
            (release.LabelInfo ?? [])
                .Select(info => EmptyToNull(info.CatalogNumber))
                .FirstOrDefault(number => number is not null));
        return true;
    }

    private static ExternalMetadataSource[] MapRelatedSources(IReadOnlyList<RelationDto>? relations)
    {
        return
        [
            .. (relations ?? [])
                .Select(TryMapDiscogsReleaseSource)
                .Where(source => source is not null)
                .Select(source => source!)
                .DistinctBy(source => source.ExternalId, StringComparer.Ordinal)
        ];
    }

    private static ExternalMetadataSource? TryMapDiscogsReleaseSource(RelationDto relation)
    {
        if (!string.Equals(relation.TypeId?.Trim(), DiscogsReleaseRelationshipId, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(relation.TargetType?.Trim(), "url", StringComparison.OrdinalIgnoreCase) ||
            string.IsNullOrWhiteSpace(relation.Url?.Resource))
        {
            return null;
        }

        string resource = relation.Url.Resource.Trim();
        if (resource.Contains('\\', StringComparison.Ordinal) ||
            !Uri.TryCreate(resource, UriKind.Absolute, out Uri? uri) ||
            !string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase) ||
            !string.IsNullOrEmpty(uri.UserInfo) ||
            !uri.IsDefaultPort ||
            !(string.Equals(uri.Host, "discogs.com", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(uri.Host, "www.discogs.com", StringComparison.OrdinalIgnoreCase)) ||
            uri.AbsolutePath.Contains('%', StringComparison.Ordinal))
        {
            return null;
        }

        Match match = DiscogsReleasePathRegex().Match(uri.AbsolutePath);
        if (!match.Success ||
            !long.TryParse(match.Groups["id"].Value, NumberStyles.None, CultureInfo.InvariantCulture, out long id) ||
            id <= 0)
        {
            return null;
        }

        string externalId = id.ToString(CultureInfo.InvariantCulture);
        return new ExternalMetadataSource(
            "discogs",
            "release",
            externalId,
            $"https://www.discogs.com/release/{externalId}",
            "Data provided by Discogs.");
    }

    [GeneratedRegex(
        "^/(?:[A-Za-z]{2}/)?release/(?<id>[1-9][0-9]*)(?:-[^/]+)?$",
        RegexOptions.CultureInvariant)]
    private static partial Regex DiscogsReleasePathRegex();
}
