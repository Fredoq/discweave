using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Application.ExternalMetadata;
using DiscWeave.Infrastructure.ExternalMetadata.Discogs;

namespace DiscWeave.Infrastructure.Tests;

public sealed partial class MusicBrainzDiscogsReleaseResolverTests
{
    private const string RecordingMbid = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    private const string TrackMbid = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    [Fact(DisplayName = "Partial release dates preserve their exact closed intervals")]
    public void Partial_release_dates_preserve_their_exact_closed_intervals()
    {
        ExternalMetadataPartialDate year = ExternalMetadataPartialDate.ForYear(1983);
        ExternalMetadataPartialDate month = ExternalMetadataPartialDate.ForYearMonth(1983, 3);
        ExternalMetadataPartialDate day = ExternalMetadataPartialDate.ForDate(new DateOnly(1983, 3, 7));

        Assert.Equal(new DateOnly(1983, 1, 1), year.EarliestPossibleDate);
        Assert.Equal(new DateOnly(1983, 12, 31), year.LatestPossibleDate);
        Assert.Equal(new DateOnly(1983, 3, 1), month.EarliestPossibleDate);
        Assert.Equal(new DateOnly(1983, 3, 31), month.LatestPossibleDate);
        Assert.Equal(new DateOnly(1983, 3, 7), day.EarliestPossibleDate);
        Assert.Equal(day.EarliestPossibleDate, day.LatestPossibleDate);
        _ = Assert.IsType<ExternalMetadataPartialDate.YearOnly>(year);
        Assert.Equal(3, Assert.IsType<ExternalMetadataPartialDate.YearMonth>(month).Month);
        Assert.Equal(7, Assert.IsType<ExternalMetadataPartialDate.FullDate>(day).Day);
        _ = Assert.Throws<ArgumentOutOfRangeException>(() =>
            ExternalMetadataPartialDate.ForYearMonth(1983, 13));
    }

    [Fact(DisplayName = "Discogs row fingerprints follow the fixed normalized vector")]
    public void Discogs_row_fingerprints_follow_the_fixed_normalized_vector()
    {
        string fingerprint = DiscogsReleaseRowFingerprint.Create(
            " A1 ",
            "Cafe\u0301",
            [" ARTIST ", "feat.\tguest"],
            TimeSpan.FromMinutes(3));

        Assert.Equal(
            "e26df47381a254f7dc02e009070a78027fe68b12d5cdf8e0166ff1333e3066b3",
            fingerprint);
        Assert.Equal(fingerprint, fingerprint.ToLowerInvariant());
        Assert.NotEqual(
            fingerprint,
            DiscogsReleaseRowFingerprint.Create(
                "A2",
                "Café",
                ["artist", "feat. guest"],
                TimeSpan.FromMinutes(3)));
    }

    [Fact(DisplayName = "A direct Discogs relationship still requires one compatible row")]
    public void A_direct_Discogs_relationship_still_requires_one_compatible_row()
    {
        var matcher = new MusicBrainzDiscogsReleaseMatcher();

        ExternalReleaseRouteMatchResult result = matcher.Match(new ExternalReleaseRouteMatchInput
        {
            MusicBrainzRelease = MusicBrainzRelease(
                ExternalMetadataPartialDate.ForYear(1983)),
            MusicBrainzMediumPosition = "1",
            MusicBrainzTrackMbid = TrackMbid,
            MusicBrainzRecordingMbid = RecordingMbid,
            DiscogsRelease = DiscogsRelease(
                ExternalMetadataPartialDate.ForYearMonth(1983, 3),
                ["5016-8392-0037-1"]),
            Authority = ExternalReleaseRouteMatchAuthority.DirectRelationship
        });

        Assert.Equal(ExternalReleaseRouteMatchOutcome.Matched, result.Outcome);
        DiscogsReleaseRouteBinding binding = Assert.Single(result.CompatibleRows);
        Assert.Equal("249504", binding.ReleaseSource.ExternalId);
        Assert.Equal(0, binding.RowOrdinal);
        Assert.Equal("A1", binding.Position);
        Assert.Contains("discogs.direct_relationship", result.EvidenceCodes);
        Assert.Empty(result.ContradictionCodes);
    }

    [Fact(DisplayName = "Deterministic matching requires a stable anchor and a complete tracklist")]
    public void Deterministic_matching_requires_a_stable_anchor_and_a_complete_tracklist()
    {
        var matcher = new MusicBrainzDiscogsReleaseMatcher();
        ExternalMetadataReleaseDetail musicBrainz = MusicBrainzRelease(
            ExternalMetadataPartialDate.ForDate(new DateOnly(1983, 3, 7)));

        ExternalReleaseRouteMatchResult anchored = matcher.Match(new ExternalReleaseRouteMatchInput
        {
            MusicBrainzRelease = musicBrainz,
            MusicBrainzMediumPosition = "1",
            MusicBrainzTrackMbid = TrackMbid,
            MusicBrainzRecordingMbid = RecordingMbid,
            DiscogsRelease = DiscogsRelease(
                ExternalMetadataPartialDate.ForYear(1983),
                ["5016839200371"]),
            Authority = ExternalReleaseRouteMatchAuthority.DeterministicEvidence
        });
        ExternalReleaseRouteMatchResult noAnchor = matcher.Match(new ExternalReleaseRouteMatchInput
        {
            MusicBrainzRelease = musicBrainz,
            MusicBrainzMediumPosition = "1",
            MusicBrainzTrackMbid = TrackMbid,
            MusicBrainzRecordingMbid = RecordingMbid,
            DiscogsRelease = DiscogsRelease(
                ExternalMetadataPartialDate.ForYear(1983),
                [],
                catalogNumber: null),
            Authority = ExternalReleaseRouteMatchAuthority.DeterministicEvidence
        });
        ExternalReleaseRouteMatchResult incomplete = matcher.Match(new ExternalReleaseRouteMatchInput
        {
            MusicBrainzRelease = musicBrainz,
            MusicBrainzMediumPosition = "1",
            MusicBrainzTrackMbid = TrackMbid,
            MusicBrainzRecordingMbid = RecordingMbid,
            DiscogsRelease = DiscogsRelease(
                ExternalMetadataPartialDate.ForYear(1983),
                ["5016839200371"],
                tracklistComplete: false),
            Authority = ExternalReleaseRouteMatchAuthority.DeterministicEvidence
        });

        Assert.Equal(ExternalReleaseRouteMatchOutcome.Matched, anchored.Outcome);
        Assert.Equal(ExternalReleaseRouteMatchOutcome.NotMatched, noAnchor.Outcome);
        Assert.Equal(ExternalReleaseRouteMatchOutcome.NotMatched, incomplete.Outcome);
        Assert.Contains("discogs.deterministic_anchor_missing", noAnchor.ContradictionCodes);
        Assert.Contains("discogs.tracklist_incomplete", incomplete.ContradictionCodes);
    }

    [Fact(DisplayName = "Multiple compatible Discogs rows are returned unpreferred")]
    public void Multiple_compatible_Discogs_rows_are_returned_unpreferred()
    {
        var matcher = new MusicBrainzDiscogsReleaseMatcher();
        ExternalMetadataReleaseDetail musicBrainz = Detail(
            MusicBrainzSource(
                "release",
                "cccccccc-cccc-cccc-cccc-cccccccccccc"),
            ExternalMetadataPartialDate.ForYear(1983),
            [
                MusicBrainzRow(),
                new ExternalMetadataReleaseTrack(
                    "Blue Monday",
                    "A1",
                    TimeSpan.FromMinutes(3),
                    ["New Order"],
                    "1",
                    null)
            ],
            ["5016839200371"],
            "FAC 73",
            ["Factory"]);
        ExternalMetadataReleaseDetail discogs = DiscogsRelease(
            ExternalMetadataPartialDate.ForYear(1983),
            ["5016839200371"],
            rows:
            [
                DiscogsRow("Blue Monday", "A1"),
                DiscogsRow("Blue Monday", "A1")
            ]);

        ExternalReleaseRouteMatchResult result = matcher.Match(new ExternalReleaseRouteMatchInput
        {
            MusicBrainzRelease = musicBrainz,
            MusicBrainzMediumPosition = "1",
            MusicBrainzTrackMbid = TrackMbid,
            MusicBrainzRecordingMbid = RecordingMbid,
            DiscogsRelease = discogs,
            Authority = ExternalReleaseRouteMatchAuthority.DirectRelationship
        });

        Assert.Equal(ExternalReleaseRouteMatchOutcome.AmbiguousRows, result.Outcome);
        Assert.Equal(2, result.CompatibleRows.Count);
        Assert.Equal([0, 1], result.CompatibleRows.Select(binding => binding.RowOrdinal));
    }

    [Fact(DisplayName = "Request budgets atomically count actual handler attempts")]
    public void Request_budgets_atomically_count_actual_handler_attempts()
    {
        var discovery =
            DiscogsOriginalDiscoveryRequestBudget.Create(2);
        DiscogsOriginalRouteRequestBudget firstRoute =
            discovery.CreateRouteBudget(1);
        DiscogsOriginalRouteRequestBudget secondRoute =
            discovery.CreateRouteBudget(2);

        Assert.Equal(
            DiscogsOriginalRequestBudgetDecision.Allowed,
            firstRoute.TryAcquireAttempt());
        Assert.Equal(
            DiscogsOriginalRequestBudgetDecision.RouteExhausted,
            firstRoute.TryAcquireAttempt());
        Assert.Equal(
            DiscogsOriginalRequestBudgetDecision.Allowed,
            secondRoute.TryAcquireAttempt());
        Assert.Equal(
            DiscogsOriginalRequestBudgetDecision.DiscoveryExhausted,
            secondRoute.TryAcquireAttempt());
        Assert.Equal(2, discovery.UsedRequestCount);
        Assert.Equal(1, firstRoute.UsedRequestCount);
        Assert.Equal(1, secondRoute.UsedRequestCount);
    }

}
