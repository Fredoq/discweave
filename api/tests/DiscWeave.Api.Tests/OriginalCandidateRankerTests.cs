using DiscWeave.Application.Catalog.OriginalDiscovery;
using DiscWeave.Domain.SharedKernel.Ids;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalCandidateRankerTests
{
    [Fact(DisplayName = "Ranker classifies every High Medium and Low branch without a score")]
    public void Ranker_classifies_every_High_Medium_and_Low_branch_without_a_score()
    {
        OriginalCandidateInput directed = Input("directed", Support(OriginalCandidateEvidenceCode.DirectedLineage),
            Contradiction(OriginalCandidateEvidenceCode.ArtistMismatch));
        OriginalCandidateInput matrix = LocalRootMatrix("matrix");
        OriginalCandidateInput medium = Input("medium", Support(OriginalCandidateEvidenceCode.IdentityMatch),
            Support(OriginalCandidateEvidenceCode.KnownLocalRoot),
            Support(OriginalCandidateEvidenceCode.CloseDuration));
        OriginalCandidateInput low = Input("low", Support(OriginalCandidateEvidenceCode.IdentityMatch),
            Support(OriginalCandidateEvidenceCode.CloseDuration));

        IReadOnlyList<RankedOriginalCandidate> result =
            OriginalCandidateRanker.Rank([low, medium, matrix, directed]);

        Assert.Equal(
            [OriginalCandidateConfidence.High, OriginalCandidateConfidence.High,
                OriginalCandidateConfidence.Medium, OriginalCandidateConfidence.Low],
            result.Select(item => item.Confidence));
        Assert.All(result, item => Assert.True(item.Selectable));
        Assert.DoesNotContain(typeof(RankedOriginalCandidate).GetProperties(),
            property => property.Name.Contains("Score", StringComparison.Ordinal));
    }

    [Theory(DisplayName = "Approved contradictions prevent local root High confidence")]
    [InlineData(OriginalCandidateEvidenceCode.LaterChronology)]
    [InlineData(OriginalCandidateEvidenceCode.ArtistMismatch)]
    [InlineData(OriginalCandidateEvidenceCode.MaterialDurationMismatch)]
    [InlineData(OriginalCandidateEvidenceCode.IncompatibleVersionMarker)]
    [InlineData(OriginalCandidateEvidenceCode.UncertainWorkMapping)]
    public void Approved_contradictions_prevent_local_root_High_confidence(
        OriginalCandidateEvidenceCode code)
    {
        OriginalCandidateInput input = LocalRootMatrix("candidate") with
        {
            Evidence = [.. LocalRootMatrix("candidate").Evidence, Contradiction(code)]
        };

        RankedOriginalCandidate result = Assert.Single(OriginalCandidateRanker.Rank([input]));

        Assert.Equal(OriginalCandidateConfidence.Medium, result.Confidence);
    }

    [Theory(DisplayName = "Every hard gate excludes the candidate")]
    [InlineData(OriginalCandidateHardGate.Self)]
    [InlineData(OriginalCandidateHardGate.ForeignCollection)]
    [InlineData(OriginalCandidateHardGate.Cycle)]
    [InlineData(OriginalCandidateHardGate.IncompatibleStack)]
    [InlineData(OriginalCandidateHardGate.ExplicitCover)]
    [InlineData(OriginalCandidateHardGate.ReversedDirectedLineage)]
    public void Every_hard_gate_excludes_the_candidate(OriginalCandidateHardGate hardGate)
    {
        OriginalCandidateInput input = LocalRootMatrix("candidate") with
        {
            HardGates = new HashSet<OriginalCandidateHardGate> { hardGate }
        };

        Assert.Empty(OriginalCandidateRanker.Rank([input]));
    }

    [Fact(DisplayName = "Ranking is stable and follows the explicit ordering matrix")]
    public void Ranking_is_stable_and_follows_the_explicit_ordering_matrix()
    {
        OriginalCandidateInput[] inputs =
        [
            Input("medium-incomplete", SupportsForMedium()) with
            {
                CandidateChronology = OriginalCandidateChronology.FromYear(1900, complete: false)
            },
            Input("medium-late", SupportsForMedium()) with
            {
                CandidateChronology = OriginalCandidateChronology.FromYear(1980, complete: true)
            },
            Input("medium-with-contradiction", [.. SupportsForMedium(),
                Contradiction(OriginalCandidateEvidenceCode.ArtistMismatch)]),
            Input("medium-more-support", [.. SupportsForMedium(),
                Support(OriginalCandidateEvidenceCode.CreditsSupport)]),
            LocalRootMatrix("high-matrix"),
            Input("medium-early", SupportsForMedium()) with
            {
                CandidateChronology = OriginalCandidateChronology.FromYear(1979, complete: true)
            },
            Input("high-directed", Support(OriginalCandidateEvidenceCode.DirectedLineage))
        ];

        string[] forward = [.. OriginalCandidateRanker.Rank(inputs).Select(item => item.CandidateKey)];
        string[] reversed = [.. OriginalCandidateRanker.Rank([.. inputs.Reverse()])
            .Select(item => item.CandidateKey)];

        Assert.Equal(
            ["high-directed", "high-matrix", "medium-more-support", "medium-early",
                "medium-late", "medium-incomplete", "medium-with-contradiction"],
            forward);
        Assert.Equal(forward, reversed);
    }

    [Fact(DisplayName = "Candidate key is the final ordinal tie break")]
    public void Candidate_key_is_the_final_ordinal_tie_break()
    {
        IReadOnlyList<RankedOriginalCandidate> result = OriginalCandidateRanker.Rank(
            [Input("z-key"), Input("A-key"), Input("a-key")]);

        Assert.Equal(["A-key", "a-key", "z-key"], result.Select(item => item.CandidateKey));
    }

    [Fact(DisplayName = "Ranking preserves zero one and multiple High results")]
    public void Ranking_preserves_zero_one_and_multiple_High_results()
    {
        int[] highCounts =
        [
            CountHigh([Input("low")]),
            CountHigh([LocalRootMatrix("one"), Input("low")]),
            CountHigh([LocalRootMatrix("one"),
                Input("two", Support(OriginalCandidateEvidenceCode.DirectedLineage))])
        ];

        Assert.Equal([0, 1, 2], highCounts);
    }

    [Fact(DisplayName = "Candidate keys use stable lowercase provider and local identifiers")]
    public void Candidate_keys_use_stable_lowercase_provider_and_local_identifiers()
    {
        var value = new Guid("ABCDEF12-3456-7890-ABCD-EF1234567890");

        Assert.Equal(
            "musicbrainz:recording:abcdef12-3456-7890-abcd-ef1234567890",
            OriginalCandidateKey.ForMusicBrainzRecording(value));
        Assert.Equal(
            "abcdef12-3456-7890-abcd-ef1234567890",
            OriginalCandidateKey.ForLocalTrack(new TrackId(value)));
    }

    private static OriginalCandidateInput LocalRootMatrix(string key)
    {
        return Input(
            key,
            Support(OriginalCandidateEvidenceCode.KnownLocalRoot),
            Support(OriginalCandidateEvidenceCode.IdentityMatch),
            Support(OriginalCandidateEvidenceCode.VersionMarker),
            Support(OriginalCandidateEvidenceCode.EarlierChronology));
    }

    private static OriginalCandidateEvidence[] SupportsForMedium()
    {
        return
        [
            Support(OriginalCandidateEvidenceCode.IdentityMatch),
            Support(OriginalCandidateEvidenceCode.KnownLocalRoot),
            Support(OriginalCandidateEvidenceCode.CloseDuration)
        ];
    }

    private static OriginalCandidateInput Input(
        string key,
        params OriginalCandidateEvidence[] evidence)
    {
        return new OriginalCandidateInput
        {
            CandidateKey = key,
            CandidateChronology = null,
            Evidence = evidence,
            HardGates = new HashSet<OriginalCandidateHardGate>()
        };
    }

    private static OriginalCandidateEvidence Support(
        OriginalCandidateEvidenceCode code,
        OriginalCandidateEvidenceChannel channel = OriginalCandidateEvidenceChannel.LocalCatalog)
    {
        return Evidence(code, OriginalCandidateEvidenceKind.Support, channel);
    }

    private static OriginalCandidateEvidence Contradiction(
        OriginalCandidateEvidenceCode code,
        OriginalCandidateEvidenceChannel channel = OriginalCandidateEvidenceChannel.LocalCatalog)
    {
        return Evidence(code, OriginalCandidateEvidenceKind.Contradiction, channel);
    }

    private static OriginalCandidateEvidence Evidence(
        OriginalCandidateEvidenceCode code,
        OriginalCandidateEvidenceKind kind,
        OriginalCandidateEvidenceChannel channel)
    {
        return new OriginalCandidateEvidence { Code = code, Kind = kind, Channel = channel };
    }

    private static int CountHigh(IReadOnlyCollection<OriginalCandidateInput> inputs)
    {
        return OriginalCandidateRanker.Rank(inputs)
            .Count(item => item.Confidence == OriginalCandidateConfidence.High);
    }
}
