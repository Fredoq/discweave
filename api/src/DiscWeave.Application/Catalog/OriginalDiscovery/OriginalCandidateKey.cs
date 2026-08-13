using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Application.Catalog.OriginalDiscovery;

public static class OriginalCandidateKey
{
    public static string ForMusicBrainzRecording(Guid recordingId)
    {
        return $"musicbrainz:recording:{recordingId:D}".ToLowerInvariant();
    }

    public static string ForLocalTrack(TrackId trackId)
    {
        return trackId.Value.ToString("D").ToLowerInvariant();
    }
}
