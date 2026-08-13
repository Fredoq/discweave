using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Api.Tests;

public sealed partial class ExternalReleaseImportBindingTests
{
    private static ExternalMetadataReleaseDetail AnomalyMusicBrainzDetail(
        Guid releaseMbid,
        Guid recordingMbid,
        Guid trackMbid,
        string discogsReleaseId)
    {
        ExternalMetadataReleaseTrack selectedTrack = new(
            "Anomaly Calling Your Name",
            "B",
            TimeSpan.FromMinutes(9) + TimeSpan.FromSeconds(54),
            ["Libra", "Taylor"],
            "1",
            null,
            externalSources:
            [
                new ExternalMetadataSource("musicbrainz", "track", trackMbid.ToString("D"), $"https://musicbrainz.org/track/{trackMbid:D}", "MusicBrainz"),
                new ExternalMetadataSource("musicbrainz", "recording", recordingMbid.ToString("D"), $"https://musicbrainz.org/recording/{recordingMbid:D}", "MusicBrainz")
            ]);
        return new ExternalMetadataReleaseDetail(
            new ExternalMetadataSource(
                "musicbrainz",
                "release",
                releaseMbid.ToString("D"),
                $"https://musicbrainz.org/release/{releaseMbid:D}",
                "MusicBrainz"),
            "Earoica / Anomaly Calling Your Name",
            ["Libra", "Taylor"],
            1995,
            null,
            ["Musicnow Records"],
            ["12\" Vinyl"],
            "single",
            [],
            [
                new ExternalMetadataReleaseTrack(
                    "Earoica",
                    "A",
                    TimeSpan.FromMinutes(7) + TimeSpan.FromSeconds(56),
                    ["Libra", "Taylor"],
                    "1",
                    null),
                selectedTrack
            ],
            [],
            "MNR-008",
            [new ExternalMetadataReleaseLabel("Musicnow Records", "MNR-008")],
            [],
            relatedSources:
            [
                new ExternalMetadataSource(
                    "discogs",
                    "release",
                    discogsReleaseId,
                    $"https://www.discogs.com/release/{discogsReleaseId}",
                    "Data provided by Discogs.")
            ]);
    }

    private static ExternalMetadataReleaseDetail AnomalyDiscogsDetail(
        string releaseId)
    {
        return new ExternalMetadataReleaseDetail(
            new ExternalMetadataSource(
                "discogs",
                "release",
                releaseId,
                $"https://www.discogs.com/release/{releaseId}",
                "Data provided by Discogs."),
            "Anomaly (Calling Your Name) / Earoica",
            ["Libra", "Taylor"],
            1995,
            null,
            ["Musicnow Records"],
            ["Vinyl", "12\"", "33 ⅓ RPM"],
            "single",
            [],
            [
                new ExternalMetadataReleaseTrack(
                    "Anomaly (Calling Your Name)",
                    "A",
                    TimeSpan.FromMinutes(9) + TimeSpan.FromSeconds(54),
                    [],
                    null,
                    null),
                new ExternalMetadataReleaseTrack(
                    "Earoica",
                    "B",
                    TimeSpan.FromMinutes(7) + TimeSpan.FromSeconds(56),
                    [],
                    null,
                    null)
            ],
            [],
            "MNR-008",
            [new ExternalMetadataReleaseLabel("Musicnow Records", "MNR-008")],
            []);
    }
}
