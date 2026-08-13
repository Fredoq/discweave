using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalCandidateRankerTests
{
    [Fact(DisplayName = "Missing artist prevents identity confidence and selection")]
    public void Missing_artist_prevents_identity_confidence_and_selection()
    {
        OriginalCandidateFacts facts = HighShapedFacts() with
        {
            CandidatePrimaryArtist = null
        };

        OriginalCandidateInput input = OriginalCandidateEvidenceExtractor.Extract(facts);
        RankedOriginalCandidate ranked = Assert.Single(OriginalCandidateRanker.Rank([input]));

        AssertEvidence(input, OriginalCandidateEvidenceCode.MissingArtist, OriginalCandidateEvidenceKind.Missing);
        Assert.DoesNotContain(input.Evidence, item =>
            item.Code == OriginalCandidateEvidenceCode.IdentityMatch);
        Assert.Equal(OriginalCandidateConfidence.Low, ranked.Confidence);
        Assert.False(ranked.Selectable);
    }

    [Fact(DisplayName = "Artist mismatch prevents identity confidence and selection")]
    public void Artist_mismatch_prevents_identity_confidence_and_selection()
    {
        OriginalCandidateFacts facts = HighShapedFacts() with
        {
            CandidatePrimaryArtist = "Different Artist"
        };

        OriginalCandidateInput input = OriginalCandidateEvidenceExtractor.Extract(facts);
        RankedOriginalCandidate ranked = Assert.Single(OriginalCandidateRanker.Rank([input]));

        AssertEvidence(
            input,
            OriginalCandidateEvidenceCode.ArtistMismatch,
            OriginalCandidateEvidenceKind.Contradiction);
        Assert.DoesNotContain(input.Evidence, item =>
            item.Code == OriginalCandidateEvidenceCode.IdentityMatch);
        Assert.Equal(OriginalCandidateConfidence.Low, ranked.Confidence);
        Assert.False(ranked.Selectable);
    }

    private static OriginalCandidateFacts HighShapedFacts()
    {
        return CreateFacts() with
        {
            KnownLocalRoot = true,
            VersionMarker = true
        };
    }
}
