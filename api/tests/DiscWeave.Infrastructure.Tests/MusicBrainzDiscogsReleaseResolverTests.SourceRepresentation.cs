using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    [Fact(DisplayName = "Direct release links tolerate source-side track ordering and punctuation")]
    public void Direct_release_links_tolerate_source_side_track_ordering_and_punctuation()
    {
        ExternalMetadataReleaseDetail musicBrainz = Detail(
            MusicBrainzSource(
                "release",
                "cccccccc-cccc-cccc-cccc-cccccccccccc"),
            ExternalMetadataPartialDate.ForYear(1995),
            [
                new ExternalMetadataReleaseTrack(
                    "Earoica",
                    "A",
                    TimeSpan.FromMinutes(7) + TimeSpan.FromSeconds(56),
                    ["Libra", "Taylor"],
                    "1",
                    null),
                new ExternalMetadataReleaseTrack(
                    "Anomaly Calling Your Name",
                    "B",
                    TimeSpan.FromMinutes(9) + TimeSpan.FromSeconds(54),
                    ["Libra", "Taylor"],
                    "1",
                    null,
                    externalSources:
                    [
                        MusicBrainzSource("track", TrackMbid),
                        MusicBrainzSource("recording", RecordingMbid)
                    ])
            ],
            [],
            "MNR-008",
            ["Musicnow Records"],
            title: "Earoica / Anomaly Calling Your Name",
            artists: ["Libra", "Taylor"]);
        ExternalMetadataReleaseDetail discogs = Detail(
            DiscogsSource("249504"),
            ExternalMetadataPartialDate.ForYear(1995),
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
            ["Musicnow Records"],
            title: "Anomaly (Calling Your Name) / Earoica",
            artists: ["Libra", "Taylor"]);

        ExternalReleaseRouteMatchResult result = MatrixMatch(
            musicBrainz,
            discogs,
            ExternalReleaseRouteMatchAuthority.DirectRelationship);

        Assert.Equal(ExternalReleaseRouteMatchOutcome.Matched, result.Outcome);
        DiscogsReleaseRouteBinding binding = Assert.Single(result.CompatibleRows);
        Assert.Equal(0, binding.RowOrdinal);
        Assert.Equal("A", binding.Position);
        Assert.Empty(result.ContradictionCodes);
    }
}
