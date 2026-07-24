using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalCandidateRankerTests
{
    [Fact(DisplayName = "Candidate chronology preserves year month and day intervals")]
    public void Candidate_chronology_preserves_year_month_and_day_intervals()
    {
        var year = OriginalCandidateChronology.FromYear(2024, complete: true);
        var month = OriginalCandidateChronology.FromMonth(2024, 2, complete: false);
        var day =
            OriginalCandidateChronology.FromDay(new DateOnly(2024, 2, 29), complete: true);

        Assert.Equal((new DateOnly(2024, 1, 1), new DateOnly(2024, 12, 31)),
            (year.LowerBound, year.UpperBound));
        Assert.Equal(OriginalCandidateDatePrecision.Year, year.Precision);
        Assert.Equal((new DateOnly(2024, 2, 1), new DateOnly(2024, 2, 29)),
            (month.LowerBound, month.UpperBound));
        Assert.Equal(OriginalCandidateDatePrecision.Month, month.Precision);
        Assert.False(month.Complete);
        Assert.Equal((day.LowerBound, day.LowerBound), (day.LowerBound, day.UpperBound));
        Assert.Equal(OriginalCandidateDatePrecision.Day, day.Precision);
    }

    [Fact(DisplayName = "Extractor creates named local evidence and preserves provider evidence")]
    public void Extractor_creates_named_local_evidence_and_preserves_provider_evidence()
    {
        OriginalCandidateEvidence providerEvidence = Contradiction(
            OriginalCandidateEvidenceCode.UncertainWorkMapping,
            OriginalCandidateEvidenceChannel.MusicBrainz);
        OriginalCandidateFacts facts = CreateFacts() with
        {
            SourceBaseTitle = "Hello—World",
            CandidateBaseTitle = "hello world",
            SourcePrimaryArtist = "Björk",
            CandidatePrimaryArtist = "BJO\u0308RK",
            DirectedLineage = true,
            KnownLocalRoot = true,
            VersionMarker = true,
            CreditsSupport = true,
            AdditionalEvidence = [providerEvidence]
        };

        OriginalCandidateInput result = OriginalCandidateEvidenceExtractor.Extract(facts);

        AssertEvidence(result, OriginalCandidateEvidenceCode.IdentityMatch, OriginalCandidateEvidenceKind.Support);
        AssertEvidence(result, OriginalCandidateEvidenceCode.DirectedLineage, OriginalCandidateEvidenceKind.Support);
        AssertEvidence(result, OriginalCandidateEvidenceCode.KnownLocalRoot, OriginalCandidateEvidenceKind.Support);
        AssertEvidence(result, OriginalCandidateEvidenceCode.VersionMarker, OriginalCandidateEvidenceKind.Support);
        AssertEvidence(result, OriginalCandidateEvidenceCode.CreditsSupport, OriginalCandidateEvidenceKind.Support);
        Assert.Contains(providerEvidence, result.Evidence);
        Assert.All(
            result.Evidence.Where(item => item != providerEvidence),
            item => Assert.Equal(OriginalCandidateEvidenceChannel.LocalCatalog, item.Channel));
        Assert.Equal(facts.CandidateKey, result.CandidateKey);
        Assert.Same(facts.CandidateChronology, result.CandidateChronology);
        Assert.Same(facts.HardGates, result.HardGates);
    }

    [Theory(DisplayName = "Disjoint chronology intervals produce directional evidence")]
    [InlineData(1999, OriginalCandidateEvidenceCode.EarlierChronology,
        OriginalCandidateEvidenceKind.Support)]
    [InlineData(2001, OriginalCandidateEvidenceCode.LaterChronology,
        OriginalCandidateEvidenceKind.Contradiction)]
    public void Disjoint_chronology_intervals_produce_directional_evidence(
        int candidateYear,
        OriginalCandidateEvidenceCode code,
        OriginalCandidateEvidenceKind kind)
    {
        OriginalCandidateFacts facts = CreateFacts() with
        {
            SourceChronology = OriginalCandidateChronology.FromYear(2000, complete: true),
            CandidateChronology = OriginalCandidateChronology.FromYear(candidateYear, complete: true)
        };

        OriginalCandidateInput result = OriginalCandidateEvidenceExtractor.Extract(facts);

        AssertEvidence(result, code, kind);
    }

    [Fact(DisplayName = "Overlapping chronology intervals produce neither earlier nor later evidence")]
    public void Overlapping_chronology_intervals_produce_neither_earlier_nor_later_evidence()
    {
        OriginalCandidateFacts facts = CreateFacts() with
        {
            SourceChronology = OriginalCandidateChronology.FromYear(2000, complete: true),
            CandidateChronology = OriginalCandidateChronology.FromMonth(2000, 6, complete: true)
        };

        OriginalCandidateInput result = OriginalCandidateEvidenceExtractor.Extract(facts);

        Assert.DoesNotContain(result.Evidence, item =>
            item.Code is OriginalCandidateEvidenceCode.EarlierChronology
                or OriginalCandidateEvidenceCode.LaterChronology);
    }

    [Fact(DisplayName = "Incomplete chronology is contradictory but not directional")]
    public void Incomplete_chronology_is_contradictory_but_not_directional()
    {
        OriginalCandidateFacts facts = CreateFacts() with
        {
            SourceChronology = OriginalCandidateChronology.FromYear(2000, complete: true),
            CandidateChronology = OriginalCandidateChronology.FromYear(1990, complete: false)
        };

        OriginalCandidateInput result = OriginalCandidateEvidenceExtractor.Extract(facts);

        AssertEvidence(
            result,
            OriginalCandidateEvidenceCode.IncompleteChronology,
            OriginalCandidateEvidenceKind.Contradiction);
        Assert.DoesNotContain(result.Evidence, item =>
            item.Code is OriginalCandidateEvidenceCode.EarlierChronology
                or OriginalCandidateEvidenceCode.LaterChronology);
    }

    [Theory(DisplayName = "Close duration includes the exact absolute and percentage thresholds")]
    [InlineData(60, 5)]
    [InlineData(200, 10)]
    public void Close_duration_includes_the_exact_absolute_and_percentage_thresholds(
        int sourceSeconds,
        int differenceSeconds)
    {
        OriginalCandidateInput result = ExtractDurations(
            TimeSpan.FromSeconds(sourceSeconds),
            TimeSpan.FromSeconds(sourceSeconds + differenceSeconds));

        AssertEvidence(result, OriginalCandidateEvidenceCode.CloseDuration, OriginalCandidateEvidenceKind.Support);
    }

    [Theory(DisplayName = "The first duration value beyond the close threshold is not close")]
    [InlineData(60, 5)]
    [InlineData(200, 10)]
    public void The_first_duration_value_beyond_the_close_threshold_is_not_close(
        int sourceSeconds,
        int thresholdSeconds)
    {
        TimeSpan candidate = TimeSpan.FromSeconds(sourceSeconds + thresholdSeconds) + TimeSpan.FromTicks(1);

        OriginalCandidateInput result = ExtractDurations(TimeSpan.FromSeconds(sourceSeconds), candidate);

        Assert.DoesNotContain(result.Evidence, item =>
            item.Code == OriginalCandidateEvidenceCode.CloseDuration);
    }

    [Theory(DisplayName = "Material duration mismatch excludes the exact threshold")]
    [InlineData(60, 30)]
    [InlineData(200, 40)]
    public void Material_duration_mismatch_excludes_the_exact_threshold(
        int sourceSeconds,
        int thresholdSeconds)
    {
        OriginalCandidateInput result = ExtractDurations(
            TimeSpan.FromSeconds(sourceSeconds),
            TimeSpan.FromSeconds(sourceSeconds + thresholdSeconds));

        Assert.DoesNotContain(result.Evidence, item =>
            item.Code == OriginalCandidateEvidenceCode.MaterialDurationMismatch);
    }

    [Theory(DisplayName = "Material duration mismatch starts at the first value above its threshold")]
    [InlineData(60, 30)]
    [InlineData(200, 40)]
    public void Material_duration_mismatch_starts_at_the_first_value_above_its_threshold(
        int sourceSeconds,
        int thresholdSeconds)
    {
        TimeSpan candidate = TimeSpan.FromSeconds(sourceSeconds + thresholdSeconds) + TimeSpan.FromTicks(1);

        OriginalCandidateInput result = ExtractDurations(TimeSpan.FromSeconds(sourceSeconds), candidate);

        AssertEvidence(
            result,
            OriginalCandidateEvidenceCode.MaterialDurationMismatch,
            OriginalCandidateEvidenceKind.Contradiction);
    }

    [Fact(DisplayName = "Missing duration produces named missing evidence")]
    public void Missing_duration_produces_named_missing_evidence()
    {
        OriginalCandidateFacts facts = CreateFacts() with
        {
            CandidatePrimaryArtist = null,
            CandidateDuration = null,
            CandidateChronology = null,
            VersionMarker = false
        };

        OriginalCandidateInput result = OriginalCandidateEvidenceExtractor.Extract(facts);

        AssertEvidence(result, OriginalCandidateEvidenceCode.MissingArtist, OriginalCandidateEvidenceKind.Missing);
        AssertEvidence(result, OriginalCandidateEvidenceCode.MissingDuration, OriginalCandidateEvidenceKind.Missing);
        AssertEvidence(
            result,
            OriginalCandidateEvidenceCode.MissingChronology,
            OriginalCandidateEvidenceKind.Missing);
        AssertEvidence(
            result,
            OriginalCandidateEvidenceCode.MissingVersionMarker,
            OriginalCandidateEvidenceKind.Missing);
    }

    private static OriginalCandidateFacts CreateFacts()
    {
        return new OriginalCandidateFacts
        {
            CandidateKey = "candidate",
            SourceBaseTitle = "Song",
            CandidateBaseTitle = "Song",
            SourcePrimaryArtist = "Artist",
            CandidatePrimaryArtist = "Artist",
            SourceDuration = TimeSpan.FromMinutes(3),
            CandidateDuration = TimeSpan.FromMinutes(3),
            SourceChronology = OriginalCandidateChronology.FromYear(2000, complete: true),
            CandidateChronology = OriginalCandidateChronology.FromYear(1999, complete: true),
            DirectedLineage = false,
            KnownLocalRoot = false,
            VersionMarker = false,
            CreditsSupport = false,
            HardGates = new HashSet<OriginalCandidateHardGate>(),
            AdditionalEvidence = []
        };
    }

    private static OriginalCandidateInput ExtractDurations(TimeSpan source, TimeSpan candidate)
    {
        return OriginalCandidateEvidenceExtractor.Extract(CreateFacts() with
        {
            SourceDuration = source,
            CandidateDuration = candidate
        });
    }

    private static void AssertEvidence(
        OriginalCandidateInput input,
        OriginalCandidateEvidenceCode code,
        OriginalCandidateEvidenceKind kind)
    {
        Assert.Contains(input.Evidence, item => item.Code == code && item.Kind == kind);
    }
}
