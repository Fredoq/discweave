using System.Globalization;
using DiscWeave.Domain.Imports;

namespace DiscWeave.Api.Features.Imports;

public static class ExternalReleaseProviderReferenceFactory
{
    public static ReleaseImportProviderReference MusicBrainzRelease(Guid releaseMbid)
    {
        return CreateMusicBrainz("release", releaseMbid);
    }

    public static ReleaseImportProviderReference MusicBrainzRecording(Guid recordingMbid)
    {
        return CreateMusicBrainz("recording", recordingMbid);
    }

    public static ReleaseImportProviderReference MusicBrainzTrack(Guid trackMbid)
    {
        return CreateMusicBrainz("track", trackMbid);
    }

    public static ReleaseImportProviderReference DiscogsRelease(string releaseId)
    {
        if (!long.TryParse(releaseId, NumberStyles.Integer, CultureInfo.InvariantCulture, out long parsed) ||
            parsed <= 0)
        {
            throw new ArgumentException("Discogs release ID must be a positive integer", nameof(releaseId));
        }

        string normalized = parsed.ToString(CultureInfo.InvariantCulture);
        return ReleaseImportProviderReference.Create(
            "discogs",
            "release",
            normalized,
            $"https://www.discogs.com/release/{normalized}");
    }

    private static ReleaseImportProviderReference CreateMusicBrainz(string resourceType, Guid mbid)
    {
        string normalized = mbid.ToString("D").ToLowerInvariant();
        return ReleaseImportProviderReference.Create(
            "musicbrainz",
            resourceType,
            normalized,
            $"https://musicbrainz.org/{resourceType}/{normalized}");
    }
}
