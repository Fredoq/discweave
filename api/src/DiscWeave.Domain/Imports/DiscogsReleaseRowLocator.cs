using System.Globalization;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class DiscogsReleaseRowLocator
{
    private DiscogsReleaseRowLocator()
    {
    }

    private DiscogsReleaseRowLocator(
        string releaseId,
        int rowOrdinal,
        string position,
        string fingerprint)
    {
        ReleaseId = releaseId;
        RowOrdinal = rowOrdinal;
        Position = position;
        Fingerprint = fingerprint;
    }

    public string ReleaseId { get; private init; } = string.Empty;

    public int RowOrdinal { get; private init; }

    public string Position { get; private init; } = string.Empty;

    public string Fingerprint { get; private init; } = string.Empty;

    public ReleaseImportProviderReference ToTrackSource()
    {
        return ReleaseImportProviderReference.Create("discogs", "release-track",
            $"{ReleaseId}:{RowOrdinal.ToString(CultureInfo.InvariantCulture)}:{Fingerprint}",
            $"https://www.discogs.com/release/{ReleaseId}");
    }

    public static DiscogsReleaseRowLocator Create(
        string releaseId,
        int rowOrdinal,
        string position,
        string fingerprint)
    {
        return new DiscogsReleaseRowLocator(
            NormalizeReleaseId(releaseId),
            rowOrdinal >= 0
                ? rowOrdinal
                : throw new DomainException(
                    "release_import.discogs_row_ordinal_invalid",
                    "Discogs row ordinal must be non-negative"),
            NormalizePosition(position),
            NormalizeFingerprint(fingerprint));
    }

    internal bool HasSameValueAs(DiscogsReleaseRowLocator other)
    {
        return other is not null &&
            ReleaseId == other.ReleaseId &&
            RowOrdinal == other.RowOrdinal &&
            Position == other.Position &&
            Fingerprint == other.Fingerprint;
    }

    private static string NormalizeReleaseId(string releaseId)
    {
        string normalized = Guard.RequiredText(
            releaseId,
            nameof(releaseId),
            "release_import.discogs_release_id_required");
        return long.TryParse(normalized, NumberStyles.None, CultureInfo.InvariantCulture, out long id) && id > 0
            ? id.ToString(CultureInfo.InvariantCulture)
            : throw new DomainException(
                "release_import.discogs_release_id_invalid",
                "Discogs release ID must be a positive integer");
    }

    private static string NormalizeFingerprint(string fingerprint)
    {
        string normalized = Guard.RequiredText(
            fingerprint,
            nameof(fingerprint),
            "release_import.discogs_row_fingerprint_required").ToLowerInvariant();
        return normalized.Length == 64 && normalized.All(Uri.IsHexDigit)
            ? normalized
            : throw new DomainException(
                "release_import.discogs_row_fingerprint_invalid",
                "Discogs row fingerprint must be a SHA-256 hexadecimal value");
    }

    private static string NormalizePosition(string position)
    {
        string normalized = ReleaseImportProviderTextNormalizer.Normalize(position);
        return normalized.Length > 0
            ? normalized
            : throw new DomainException(
                "release_import.discogs_row_position_required",
                "Discogs row position is required");
    }
}
