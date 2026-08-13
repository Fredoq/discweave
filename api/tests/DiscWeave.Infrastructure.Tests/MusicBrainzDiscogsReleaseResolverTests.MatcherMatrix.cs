using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    [Theory(DisplayName = "Release contradictions are individually explicit")]
    [InlineData("barcode", "discogs.barcode_contradiction")]
    [InlineData("catalog", "discogs.catalog_number_contradiction")]
    [InlineData("label", "discogs.label_contradiction")]
    [InlineData("date", "discogs.release_date_contradiction")]
    [InlineData("title", "discogs.release_title_contradiction")]
    [InlineData("artist", "discogs.release_artist_contradiction")]
    [InlineData("tracklist", "discogs.tracklist_contradiction")]
    public void Release_contradictions_are_individually_explicit(
        string vector,
        string expectedCode)
    {
        ExternalMetadataReleaseDetail discogs = vector switch
        {
            "barcode" => MatrixDiscogs(barcodes: ["999"]),
            "catalog" => MatrixDiscogs(catalog: "OTHER"),
            "label" => MatrixDiscogs(labels: ["Other"]),
            "date" => MatrixDiscogs(
                date: ExternalMetadataPartialDate.ForYear(1984)),
            "title" => MatrixDiscogs(title: "Other"),
            "artist" => MatrixDiscogs(artists: ["Other"]),
            "tracklist" => MatrixDiscogs(
                rows:
                [
                    DiscogsRow("Blue Monday", "A1"),
                    DiscogsRow("Other", "A2")
                ]),
            _ => throw new ArgumentOutOfRangeException(
                nameof(vector))
        };

        ExternalReleaseRouteMatchResult result = MatrixMatch(
            MusicBrainzRelease(
                ExternalMetadataPartialDate.ForYear(1983)),
            discogs);

        Assert.Equal(
            ExternalReleaseRouteMatchOutcome.NotMatched,
            result.Outcome);
        Assert.Contains(expectedCode, result.ContradictionCodes);
    }

    [Theory(DisplayName = "Selected row incompatibilities never bind")]
    [InlineData("title")]
    [InlineData("artist")]
    [InlineData("duration")]
    public void Selected_row_incompatibilities_never_bind(
        string vector)
    {
        ExternalMetadataReleaseTrack row = vector switch
        {
            "title" => DiscogsRow("Other", "A1"),
            "artist" => new ExternalMetadataReleaseTrack(
                "Blue Monday",
                "A1",
                TimeSpan.FromMinutes(3),
                ["Other"],
                null,
                null),
            "duration" => new ExternalMetadataReleaseTrack(
                "Blue Monday",
                "A1",
                TimeSpan.FromMinutes(4),
                ["New Order"],
                null,
                null),
            _ => throw new ArgumentOutOfRangeException(
                nameof(vector))
        };

        ExternalReleaseRouteMatchResult result = MatrixMatch(
            MusicBrainzRelease(
                ExternalMetadataPartialDate.ForYear(1983)),
            MatrixDiscogs(rows: [row]),
            ExternalReleaseRouteMatchAuthority.DirectRelationship);

        Assert.Equal(
            ExternalReleaseRouteMatchOutcome.NotMatched,
            result.Outcome);
        Assert.Empty(result.CompatibleRows);
    }

    [Theory(DisplayName = "Malformed MusicBrainz row source sets are rejected")]
    [InlineData("wrong-recording")]
    [InlineData("missing-track")]
    [InlineData("duplicate-track")]
    public void Malformed_MusicBrainz_row_source_sets_are_rejected(
        string vector)
    {
        IReadOnlyList<ExternalMetadataSource> sources = vector switch
        {
            "wrong-recording" =>
            [
                MusicBrainzSource("track", TrackMbid),
                MusicBrainzSource(
                    "recording",
                    "dddddddd-dddd-dddd-dddd-dddddddddddd")
            ],
            "missing-track" =>
            [
                MusicBrainzSource("recording", RecordingMbid)
            ],
            "duplicate-track" =>
            [
                MusicBrainzSource("track", TrackMbid),
                MusicBrainzSource("track", TrackMbid)
            ],
            _ => throw new ArgumentOutOfRangeException(
                nameof(vector))
        };
        var row = new ExternalMetadataReleaseTrack(
            "Blue Monday",
            "A1",
            TimeSpan.FromMinutes(3),
            ["New Order"],
            "1",
            null,
            externalSources: sources);
        ExternalMetadataReleaseDetail musicBrainz = Detail(
            MusicBrainzSource(
                "release",
                "cccccccc-cccc-cccc-cccc-cccccccccccc"),
            ExternalMetadataPartialDate.ForYear(1983),
            [row],
            ["5016839200371"],
            "FAC 73",
            ["Factory"]);

        ExternalReleaseRouteMatchResult result = MatrixMatch(
            musicBrainz,
            MatrixDiscogs(),
            ExternalReleaseRouteMatchAuthority.DirectRelationship);

        Assert.Equal(
            ExternalReleaseRouteMatchOutcome.NotMatched,
            result.Outcome);
        Assert.Contains(
            "musicbrainz.release_row_invalid",
            result.ContradictionCodes);
    }

    [Fact(DisplayName = "Missing release date does not synthesize a contradiction")]
    public void Missing_release_date_does_not_synthesize_a_contradiction()
    {
        ExternalMetadataReleaseDetail discogs =
            new(
                DiscogsSource("249504"),
                "Blue Monday",
                ["New Order"],
                null,
                null,
                ["Factory"],
                ["Vinyl"],
                "single",
                [],
                [DiscogsRow("Blue Monday", "A1")],
                [new ExternalMetadataIdentifier(
                    "Barcode",
                    "5016839200371")],
                "FAC 73",
                [],
                [],
                tracklistComplete: true);

        ExternalReleaseRouteMatchResult result = MatrixMatch(
            MusicBrainzRelease(
                ExternalMetadataPartialDate.ForDate(
                    new DateOnly(1983, 3, 7))),
            discogs);

        Assert.Equal(
            ExternalReleaseRouteMatchOutcome.Matched,
            result.Outcome);
        Assert.DoesNotContain(
            "discogs.release_date_contradiction",
            result.ContradictionCodes);
    }

    [Fact(DisplayName = "Catalog number and label anchor without a barcode")]
    public void Catalog_number_and_label_anchor_without_a_barcode()
    {
        ExternalReleaseRouteMatchResult result = MatrixMatch(
            MusicBrainzRelease(
                ExternalMetadataPartialDate.ForYear(1983)),
            MatrixDiscogs(barcodes: []));

        Assert.Equal(
            ExternalReleaseRouteMatchOutcome.Matched,
            result.Outcome);
        Assert.Contains(
            "discogs.catalog_and_label",
            result.EvidenceCodes);
        Assert.DoesNotContain(
            "discogs.shared_barcode",
            result.EvidenceCodes);
    }

    private static ExternalMetadataReleaseDetail MatrixDiscogs(
        ExternalMetadataPartialDate? date = null,
        IReadOnlyList<string>? barcodes = null,
        string? catalog = "FAC-73",
        IReadOnlyList<string>? labels = null,
        IReadOnlyList<ExternalMetadataReleaseTrack>? rows = null,
        string title = "Blue Monday",
        IReadOnlyList<string>? artists = null)
    {
        return Detail(
            DiscogsSource("249504"),
            date ?? ExternalMetadataPartialDate.ForYear(1983),
            rows ?? [DiscogsRow("Blue Monday", "A1")],
            barcodes ?? ["5016839200371"],
            catalog,
            labels ?? ["Factory"],
            title: title,
            artists: artists);
    }

    private static ExternalReleaseRouteMatchResult MatrixMatch(
        ExternalMetadataReleaseDetail musicBrainz,
        ExternalMetadataReleaseDetail discogs,
        ExternalReleaseRouteMatchAuthority authority =
            ExternalReleaseRouteMatchAuthority.DeterministicEvidence)
    {
        return new MusicBrainzDiscogsReleaseMatcher().Match(
            new ExternalReleaseRouteMatchInput
            {
                MusicBrainzRelease = musicBrainz,
                MusicBrainzMediumPosition = "1",
                MusicBrainzTrackMbid = TrackMbid,
                MusicBrainzRecordingMbid = RecordingMbid,
                DiscogsRelease = discogs,
                Authority = authority
            });
    }
}
