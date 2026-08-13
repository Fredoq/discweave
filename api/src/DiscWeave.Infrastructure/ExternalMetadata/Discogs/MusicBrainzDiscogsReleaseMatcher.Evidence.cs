using System.Globalization;
using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Domain.SharedKernel.Optional;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseMatcher
{
    private static void AddReleaseContradictions(
        ExternalReleaseRouteMatchInput input,
        SortedSet<string> contradictions)
    {
        ExternalMetadataReleaseDetail musicBrainz = input.MusicBrainzRelease;
        ExternalMetadataReleaseDetail discogs = input.DiscogsRelease;
        AddSetContradiction(
            Barcodes(musicBrainz),
            Barcodes(discogs),
            "discogs.barcode_contradiction",
            contradictions);
        AddSetContradiction(
            musicBrainz.Labels.Select(DiscogsReleaseRowFingerprint.NormalizeText),
            discogs.Labels.Select(DiscogsReleaseRowFingerprint.NormalizeText),
            "discogs.label_contradiction",
            contradictions);
        string musicBrainzCatalog = NormalizeCatalog(musicBrainz.CatalogNumber);
        string discogsCatalog = NormalizeCatalog(discogs.CatalogNumber);
        if (musicBrainzCatalog.Length > 0 && discogsCatalog.Length > 0 &&
            !string.Equals(musicBrainzCatalog, discogsCatalog, StringComparison.Ordinal))
        {
            _ = contradictions.Add("discogs.catalog_number_contradiction");
        }

        if (!ReleaseTitlesEqualWhenPresent(musicBrainz.Title, discogs.Title))
        {
            _ = contradictions.Add("discogs.release_title_contradiction");
        }

        if (!SetsIntersectWhenBothPresent(
            musicBrainz.Artists.Select(DiscogsReleaseRowFingerprint.NormalizeText),
            discogs.Artists.Select(DiscogsReleaseRowFingerprint.NormalizeText)))
        {
            _ = contradictions.Add("discogs.release_artist_contradiction");
        }

        ExternalMetadataPartialDate? musicBrainzDate = PresentDate(musicBrainz);
        ExternalMetadataPartialDate? discogsDate = PresentDate(discogs);
        if (musicBrainzDate is not null && discogsDate is not null &&
            (musicBrainzDate.LatestPossibleDate < discogsDate.EarliestPossibleDate ||
             discogsDate.LatestPossibleDate < musicBrainzDate.EarliestPossibleDate))
        {
            _ = contradictions.Add("discogs.release_date_contradiction");
        }
    }

    private static bool HasDeterministicAnchor(
        ExternalReleaseRouteMatchInput input,
        SortedSet<string> evidence)
    {
        bool sharedBarcode = Intersects(
            Barcodes(input.MusicBrainzRelease),
            Barcodes(input.DiscogsRelease));
        bool catalogAndLabel =
            string.Equals(
                NormalizeCatalog(input.MusicBrainzRelease.CatalogNumber),
                NormalizeCatalog(input.DiscogsRelease.CatalogNumber),
                StringComparison.Ordinal) &&
            NormalizeCatalog(input.MusicBrainzRelease.CatalogNumber).Length > 0 &&
            Intersects(
                input.MusicBrainzRelease.Labels.Select(
                    DiscogsReleaseRowFingerprint.NormalizeText),
                input.DiscogsRelease.Labels.Select(
                    DiscogsReleaseRowFingerprint.NormalizeText));
        if (sharedBarcode)
        {
            _ = evidence.Add("discogs.shared_barcode");
        }

        if (catalogAndLabel)
        {
            _ = evidence.Add("discogs.catalog_and_label");
        }

        return sharedBarcode || catalogAndLabel;
    }

    private static ExternalMetadataPartialDate? PresentDate(
        ExternalMetadataReleaseDetail detail)
    {
        return detail.ReleaseDateEvidence is
            PresentOptionalValue<ExternalMetadataPartialDate> present
                ? present.Value
                : null;
    }

    private static IEnumerable<string> Barcodes(
        ExternalMetadataReleaseDetail detail)
    {
        return detail.Identifiers
            .Where(identifier =>
                string.Equals(identifier.Type, "barcode", StringComparison.OrdinalIgnoreCase))
            .Select(identifier =>
                string.Concat(identifier.Value.Where(char.IsAsciiDigit)))
            .Where(value => value.Length > 0);
    }

    private static string NormalizeCatalog(string? value)
    {
        return string.Concat(
            DiscogsReleaseRowFingerprint.NormalizeText(value)
                .Where(character =>
                    !char.IsWhiteSpace(character) &&
                    character is not '-' and not '/'));
    }

    private static void AddSetContradiction(
        IEnumerable<string> left,
        IEnumerable<string> right,
        string code,
        SortedSet<string> contradictions)
    {
        string[] leftValues = [.. left.Where(value => value.Length > 0).Distinct(StringComparer.Ordinal)];
        string[] rightValues = [.. right.Where(value => value.Length > 0).Distinct(StringComparer.Ordinal)];
        if (leftValues.Length > 0 && rightValues.Length > 0 &&
            !Intersects(leftValues, rightValues))
        {
            _ = contradictions.Add(code);
        }
    }

    private static bool SetsIntersectWhenBothPresent(
        IEnumerable<string> left,
        IEnumerable<string> right)
    {
        string[] leftValues = [.. left.Where(value => value.Length > 0)];
        string[] rightValues = [.. right.Where(value => value.Length > 0)];
        return leftValues.Length == 0 || rightValues.Length == 0 ||
            Intersects(leftValues, rightValues);
    }

    private static bool Intersects(
        IEnumerable<string> left,
        IEnumerable<string> right)
    {
        return left.Intersect(right, StringComparer.Ordinal).Any();
    }

    private static bool TryCanonicalMbid(string value, out string mbid)
    {
        mbid = value?.Trim() ?? string.Empty;
        return Guid.TryParseExact(mbid, "D", out Guid parsed) &&
            string.Equals(
                mbid,
                parsed.ToString("D").ToLowerInvariant(),
                StringComparison.Ordinal);
    }

    private static bool TryPositivePosition(string? value, out int position)
    {
        string normalized = value?.Trim() ?? string.Empty;
        return int.TryParse(
                normalized,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out position) &&
            position > 0 &&
            string.Equals(
                normalized,
                position.ToString(CultureInfo.InvariantCulture),
                StringComparison.Ordinal);
    }
}
