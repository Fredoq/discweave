using System.Globalization;
using DiscWeave.Domain.SharedKernel.Errors;
using DiscWeave.Domain.SharedKernel.Validation;

namespace DiscWeave.Domain.Imports;

public sealed class MusicBrainzReleaseRowLocator
{
    private MusicBrainzReleaseRowLocator()
    {
    }

    private MusicBrainzReleaseRowLocator(
        string releaseMbid,
        string mediumPosition,
        string trackMbid)
    {
        ReleaseMbid = releaseMbid;
        MediumPosition = mediumPosition;
        TrackMbid = trackMbid;
    }

    public string ReleaseMbid { get; private init; } = string.Empty;

    public string MediumPosition { get; private init; } = string.Empty;

    public string TrackMbid { get; private init; } = string.Empty;

    public static MusicBrainzReleaseRowLocator Create(
        string releaseMbid,
        string mediumPosition,
        string trackMbid)
    {
        return new MusicBrainzReleaseRowLocator(
            NormalizeMbid(releaseMbid, nameof(releaseMbid), "release_import.musicbrainz_release_mbid_invalid"),
            NormalizeMediumPosition(mediumPosition),
            NormalizeMbid(trackMbid, nameof(trackMbid), "release_import.musicbrainz_track_mbid_invalid"));
    }

    internal bool HasSameValueAs(MusicBrainzReleaseRowLocator other)
    {
        return other is not null &&
            ReleaseMbid == other.ReleaseMbid &&
            MediumPosition == other.MediumPosition &&
            TrackMbid == other.TrackMbid;
    }

    private static string NormalizeMbid(string value, string fieldName, string code)
    {
        string normalized = Guard.RequiredText(value, fieldName, code);
        return Guid.TryParse(normalized, out Guid guid) && guid != Guid.Empty
            ? guid.ToString("D")
            : throw new DomainException(code, $"{fieldName} must be a non-empty MusicBrainz identifier");
    }

    private static string NormalizeMediumPosition(string mediumPosition)
    {
        string normalized = Guard.RequiredText(
            mediumPosition,
            nameof(mediumPosition),
            "release_import.musicbrainz_medium_position_required");
        return int.TryParse(
                normalized,
                NumberStyles.None,
                CultureInfo.InvariantCulture,
                out int position) && position > 0
            ? position.ToString(CultureInfo.InvariantCulture)
            : throw new DomainException(
                "release_import.musicbrainz_medium_position_invalid",
                "MusicBrainz medium position must be a positive integer");
    }
}
