using DiscWeave.Application.Catalog.OriginalDiscovery;

namespace DiscWeave.Api.Tests;

public sealed partial class OriginalCandidateRankerTests
{
    [Fact(DisplayName = "Duplicate cross-channel support cannot outrank more distinct support")]
    public void Duplicate_cross_channel_support_cannot_outrank_more_distinct_support()
    {
        OriginalCandidateInput duplicate = Input(
            "duplicate",
            Support(
                OriginalCandidateEvidenceCode.CloseDuration,
                OriginalCandidateEvidenceChannel.LocalCatalog),
            Support(
                OriginalCandidateEvidenceCode.CloseDuration,
                OriginalCandidateEvidenceChannel.MusicBrainz),
            Support(
                OriginalCandidateEvidenceCode.CloseDuration,
                OriginalCandidateEvidenceChannel.Discogs));
        OriginalCandidateInput distinct = Input(
            "distinct",
            Support(
                OriginalCandidateEvidenceCode.CloseDuration,
                OriginalCandidateEvidenceChannel.LocalCatalog),
            Support(
                OriginalCandidateEvidenceCode.CreditsSupport,
                OriginalCandidateEvidenceChannel.MusicBrainz));

        IReadOnlyList<RankedOriginalCandidate> result =
            OriginalCandidateRanker.Rank([duplicate, distinct]);

        Assert.Equal(["distinct", "duplicate"], result.Select(item => item.CandidateKey));
        RankedOriginalCandidate duplicateResult =
            Assert.Single(result, item => item.CandidateKey == "duplicate");
        Assert.Equal(3, duplicateResult.SupportingEvidence.Count);
        Assert.Equal(
            [OriginalCandidateEvidenceChannel.LocalCatalog,
                OriginalCandidateEvidenceChannel.MusicBrainz,
                OriginalCandidateEvidenceChannel.Discogs],
            duplicateResult.SupportingEvidence.Select(item => item.Channel));
    }

    [Fact(DisplayName = "Duplicate cross-channel contradictions count less than more distinct contradictions")]
    public void Duplicate_cross_channel_contradictions_count_less_than_more_distinct_contradictions()
    {
        OriginalCandidateInput duplicate = Input(
            "duplicate",
            Contradiction(
                OriginalCandidateEvidenceCode.ArtistMismatch,
                OriginalCandidateEvidenceChannel.LocalCatalog),
            Contradiction(
                OriginalCandidateEvidenceCode.ArtistMismatch,
                OriginalCandidateEvidenceChannel.MusicBrainz),
            Contradiction(
                OriginalCandidateEvidenceCode.ArtistMismatch,
                OriginalCandidateEvidenceChannel.Discogs));
        OriginalCandidateInput distinct = Input(
            "distinct",
            Contradiction(
                OriginalCandidateEvidenceCode.ArtistMismatch,
                OriginalCandidateEvidenceChannel.LocalCatalog),
            Contradiction(
                OriginalCandidateEvidenceCode.LaterChronology,
                OriginalCandidateEvidenceChannel.MusicBrainz));

        IReadOnlyList<RankedOriginalCandidate> result =
            OriginalCandidateRanker.Rank([duplicate, distinct]);

        Assert.Equal(["duplicate", "distinct"], result.Select(item => item.CandidateKey));
        RankedOriginalCandidate duplicateResult =
            Assert.Single(result, item => item.CandidateKey == "duplicate");
        Assert.Equal(3, duplicateResult.Contradictions.Count);
        Assert.Equal(
            [OriginalCandidateEvidenceChannel.LocalCatalog,
                OriginalCandidateEvidenceChannel.MusicBrainz,
                OriginalCandidateEvidenceChannel.Discogs],
            duplicateResult.Contradictions.Select(item => item.Channel));
    }
}
