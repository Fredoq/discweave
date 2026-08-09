using System.Text;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.ExternalMetadata.Discogs;

public sealed partial class MusicBrainzDiscogsReleaseMatcher
{
    private static bool TracklistsAreCompatible(
        IReadOnlyList<ExternalMetadataReleaseTrack> left,
        IReadOnlyList<ExternalMetadataReleaseTrack> right)
    {
        return left.Count == right.Count &&
            HasPerfectTracklistMatching(left, right, 0, new bool[right.Count]);
    }

    private static bool RowIsCompatible(
        ExternalMetadataReleaseTrack musicBrainz,
        ExternalMetadataReleaseTrack discogs)
    {
        return !string.IsNullOrWhiteSpace(discogs.Position) &&
            TrackTitlesEqual(musicBrainz.Title, discogs.Title) &&
            ArtistsAndDurationCompatible(musicBrainz, discogs);
    }

    private static bool HasPerfectTracklistMatching(
        IReadOnlyList<ExternalMetadataReleaseTrack> musicBrainz,
        IReadOnlyList<ExternalMetadataReleaseTrack> discogs,
        int musicBrainzIndex,
        bool[] matchedDiscogsRows)
    {
        if (musicBrainzIndex == musicBrainz.Count)
        {
            return true;
        }

        for (int discogsIndex = 0; discogsIndex < discogs.Count; discogsIndex++)
        {
            if (matchedDiscogsRows[discogsIndex] ||
                !TrackTitlesEqual(
                    musicBrainz[musicBrainzIndex].Title,
                    discogs[discogsIndex].Title) ||
                !ArtistsAndDurationCompatible(
                    musicBrainz[musicBrainzIndex],
                    discogs[discogsIndex]))
            {
                continue;
            }

            matchedDiscogsRows[discogsIndex] = true;
            if (HasPerfectTracklistMatching(
                musicBrainz,
                discogs,
                musicBrainzIndex + 1,
                matchedDiscogsRows))
            {
                return true;
            }

            matchedDiscogsRows[discogsIndex] = false;
        }

        return false;
    }

    private static bool ArtistsAndDurationCompatible(
        ExternalMetadataReleaseTrack left,
        ExternalMetadataReleaseTrack right)
    {
        if (!SetsIntersectWhenBothPresent(
            left.Artists.Select(DiscogsReleaseRowFingerprint.NormalizeText),
            right.Artists.Select(DiscogsReleaseRowFingerprint.NormalizeText)))
        {
            return false;
        }

        if (left.Duration is not TimeSpan leftDuration ||
            right.Duration is not TimeSpan rightDuration)
        {
            return true;
        }

        double tolerance = Math.Max(5, leftDuration.TotalSeconds * 0.05);
        return Math.Abs((leftDuration - rightDuration).TotalSeconds) <= tolerance;
    }

    private static bool ReleaseTitlesEqualWhenPresent(string? left, string? right)
    {
        string[] normalizedLeft = NormalizeReleaseTitleParts(left);
        string[] normalizedRight = NormalizeReleaseTitleParts(right);
        return normalizedLeft.Length == 0 || normalizedRight.Length == 0 ||
            normalizedLeft.SequenceEqual(normalizedRight, StringComparer.Ordinal);
    }

    private static string[] NormalizeReleaseTitleParts(string? value)
    {
        return
        [
            .. (value ?? string.Empty)
                .Split('/', StringSplitOptions.RemoveEmptyEntries)
                .Select(NormalizeTitle)
                .Where(part => part.Length > 0)
                .Order(StringComparer.Ordinal)
        ];
    }

    private static bool TrackTitlesEqual(string? left, string? right)
    {
        string normalizedLeft = NormalizeTitle(left);
        string normalizedRight = NormalizeTitle(right);
        return normalizedLeft.Length > 0 &&
            string.Equals(normalizedLeft, normalizedRight, StringComparison.Ordinal);
    }

    private static string NormalizeTitle(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var normalized = new StringBuilder(value.Length);
        bool pendingSpace = false;
        foreach (Rune rune in value.Normalize(NormalizationForm.FormKC)
            .ToLowerInvariant()
            .EnumerateRunes())
        {
            if (!Rune.IsLetterOrDigit(rune))
            {
                pendingSpace = normalized.Length > 0;
                continue;
            }

            if (pendingSpace)
            {
                _ = normalized.Append(' ');
                pendingSpace = false;
            }

            _ = normalized.Append(rune);
        }

        return normalized.ToString();
    }
}
