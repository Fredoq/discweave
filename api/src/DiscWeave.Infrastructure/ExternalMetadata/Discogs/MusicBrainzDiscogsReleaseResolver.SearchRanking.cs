using System.Globalization;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseResolver
{
    private static IEnumerable<ExternalMetadataReleaseCandidate>
        OrderSearchCandidates(
            IEnumerable<ExternalMetadataReleaseCandidate> candidates,
            ExternalMetadataReleaseSearchQuery query)
    {
        return candidates
            .OrderByDescending(candidate =>
                SearchRelevance(candidate, query))
            .ThenBy(candidate => ReleaseId(candidate.Source))
            .ThenBy(
                candidate => candidate.Source.ExternalId,
                StringComparer.Ordinal);
    }

    private static int SearchRelevance(
        ExternalMetadataReleaseCandidate candidate,
        ExternalMetadataReleaseSearchQuery query)
    {
        int score = 0;
        string requestedBarcode = NormalizeBarcode(query.Barcode);
        score |= requestedBarcode.Length > 0 &&
            candidate.Barcodes
            .Select(NormalizeBarcode)
            .Contains(
                requestedBarcode,
                StringComparer.Ordinal)
            ? 16
            : 0;
        score |= EqualWhenPresent(
            NormalizeCatalog(candidate.CatalogNumber),
            NormalizeCatalog(query.CatalogNumber))
            ? 8
            : 0;
        score |= EqualWhenPresent(
            ReleaseTitle(candidate.Title),
            query.Title)
            ? 4
            : 0;
        score |= candidate.Artists.Any(artist =>
            EqualWhenPresent(artist, query.Artist))
            ? 2
            : 0;
        score |= candidate.Year.HasValue &&
            candidate.Year == query.Year
            ? 1
            : 0;
        return score;
    }

    private static bool EqualWhenPresent(
        string? left,
        string? right)
    {
        string normalizedLeft =
            DiscogsReleaseRowFingerprint.NormalizeText(left);
        string normalizedRight =
            DiscogsReleaseRowFingerprint.NormalizeText(right);
        return normalizedLeft.Length > 0 &&
            normalizedRight.Length > 0 &&
            string.Equals(
                normalizedLeft,
                normalizedRight,
                StringComparison.Ordinal);
    }

    private static string NormalizeBarcode(string? value)
    {
        return string.Concat(
            (value ?? string.Empty).Where(char.IsAsciiDigit));
    }

    private static string NormalizeCatalog(string? value)
    {
        return string.Concat(
            DiscogsReleaseRowFingerprint.NormalizeText(value)
                .Where(character =>
                    !char.IsWhiteSpace(character) &&
                    character is not '-' and not '/'));
    }

    private static string ReleaseTitle(string value)
    {
        string[] parts = value.Split(
            " - ",
            2,
            StringSplitOptions.TrimEntries);
        return parts.Length == 2 ? parts[1] : value;
    }

    private static long ReleaseId(
        ExternalMetadataSource source)
    {
        return long.TryParse(
                source.ExternalId,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out long id) &&
            id > 0
                ? id
                : long.MaxValue;
    }
}
