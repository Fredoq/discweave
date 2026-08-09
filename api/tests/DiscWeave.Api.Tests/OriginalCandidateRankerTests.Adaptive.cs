using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalCandidateRankerTests
{
    [Fact]
    public void Complete_shared_work_original_evidence_is_high()
    {
        OriginalCandidateInput input = ExternalInput(
            "musicbrainz:recording:root",
            OriginalCandidateRole.HistoricalRoot,
            Support(OriginalCandidateEvidenceCode.SharedWork),
            Support(OriginalCandidateEvidenceCode.MatchingArtist),
            Support(OriginalCandidateEvidenceCode.CompatibleVersionRole),
            Support(OriginalCandidateEvidenceCode.OfficialArtistRelease),
            Support(OriginalCandidateEvidenceCode.EarlierChronology));

        RankedOriginalCandidate result = Assert.Single(OriginalCandidateRanker.Rank([input]));

        Assert.Equal(OriginalCandidateConfidence.High, result.Confidence);
        Assert.Equal(OriginalCandidateRole.HistoricalRoot, result.CandidateRole);
        Assert.Contains(
            result.SupportingEvidence,
            evidence => evidence.Code == OriginalCandidateEvidenceCode.SharedWork);
    }

    [Fact]
    public void Complete_same_release_full_length_evidence_is_high_immediate_parent()
    {
        OriginalCandidateInput input = ExternalInput(
            "musicbrainz:recording:parent",
            OriginalCandidateRole.ImmediateParent,
            Support(OriginalCandidateEvidenceCode.SharedWork),
            Support(OriginalCandidateEvidenceCode.MatchingArtist),
            Support(OriginalCandidateEvidenceCode.CompatibleVersionRole),
            Support(OriginalCandidateEvidenceCode.SameOfficialRelease),
            Support(OriginalCandidateEvidenceCode.FullLengthCounterpart));

        RankedOriginalCandidate result = Assert.Single(OriginalCandidateRanker.Rank([input]));

        Assert.Equal(OriginalCandidateConfidence.High, result.Confidence);
        Assert.Equal(OriginalCandidateRole.ImmediateParent, result.CandidateRole);
    }

    [Fact]
    public void Shared_work_without_release_context_is_only_a_diagnostic()
    {
        OriginalCandidateInput input = ExternalInput(
            "musicbrainz:recording:lead",
            OriginalCandidateRole.Diagnostic,
            Support(OriginalCandidateEvidenceCode.SharedWork));

        RankedOriginalCandidate result = Assert.Single(OriginalCandidateRanker.Rank([input]));

        Assert.Equal(OriginalCandidateConfidence.Low, result.Confidence);
        Assert.False(result.Selectable);
    }

    [Fact]
    public void Incomplete_inferred_evidence_is_capped_at_medium()
    {
        OriginalCandidateInput input = ExternalInput(
            "musicbrainz:recording:partial",
            OriginalCandidateRole.HistoricalRoot,
            Support(OriginalCandidateEvidenceCode.IdentityMatch),
            Support(OriginalCandidateEvidenceCode.SharedWork),
            Support(OriginalCandidateEvidenceCode.MatchingArtist),
            Support(OriginalCandidateEvidenceCode.CompatibleVersionRole),
            Support(OriginalCandidateEvidenceCode.OfficialArtistRelease),
            Support(OriginalCandidateEvidenceCode.EarlierChronology),
            Contradiction(OriginalCandidateEvidenceCode.IncompleteStructuralEvidence));

        RankedOriginalCandidate result = Assert.Single(OriginalCandidateRanker.Rank([input]));

        Assert.Equal(OriginalCandidateConfidence.Medium, result.Confidence);
    }

    private static OriginalCandidateInput ExternalInput(
        string key,
        OriginalCandidateRole role,
        params OriginalCandidateEvidence[] evidence)
    {
        return new OriginalCandidateInput
        {
            CandidateKey = key,
            CandidateChronology = null,
            Evidence = evidence,
            HardGates = new HashSet<OriginalCandidateHardGate>(),
            CandidateRole = role
        };
    }
}
